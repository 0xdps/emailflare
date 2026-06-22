#!/bin/sh
set -e

# Node listens on this internal port — must NOT equal $PORT
export BACKEND_PORT=${BACKEND_PORT:-3001}
# Caddy listens on this public port — Railway injects PORT automatically
export PORT=${PORT:-80}
# Mailpit ports
export MAILPIT_SMTP_PORT=${MAILPIT_SMTP_PORT:-1025}
export MAILPIT_UI_PORT=${MAILPIT_UI_PORT:-8025}

echo "=========================================="
echo "  EmailFlare — Starting Services"
echo "=========================================="

# ── [0] Mesahub: embedded or external ─────────────────────────────────────────
# MESAHUB_URL format: mh://[token@]host[:port]/dbname
# Use mh://local/dbname to start a bundled mesahub-server in this container.

MESAHUB_URL="${MESAHUB_URL:-}"
if [ -z "$MESAHUB_URL" ]; then
  echo "✗ MESAHUB_URL is required (e.g. mh://token@host/db or mh://local/db)"
  exit 1
fi

# Parse: strip scheme, split on / to get host-part and dbname
_INNER="${MESAHUB_URL#mh://}"
_DBNAME="${_INNER##*/}"
_HOSTPART="${_INNER%%/*}"
if echo "$_HOSTPART" | grep -q "@"; then
  _HOST="${_HOSTPART##*@}"
else
  _HOST="$_HOSTPART"
fi

if [ "$_HOST" = "local" ]; then
  # ── Embedded mode ───────────────────────────────────────────────────────────
  export MESAHUB_CORE_PORT="${MESAHUB_CORE_PORT:-3002}"
  _ADMIN_TOKEN="${MESAHUB_ADMIN_TOKEN:-$(openssl rand -hex 32)}"

  echo "[0/5] Starting bundled mesahub-server on :$MESAHUB_CORE_PORT (db: $_DBNAME)..."
  DATA_PATH="${DATA_PATH:-/data}" \
  ADMIN_TOKEN="$_ADMIN_TOKEN" \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  FILE_TOKEN_SIGNING_SECRET="$(openssl rand -hex 32)" \
  PORT="$MESAHUB_CORE_PORT" \
    mesahub-server &
  MESAHUB_PID=$!

  max_attempts=30
  attempt=0
  until curl -sf "http://localhost:${MESAHUB_CORE_PORT}/api/health" > /dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ $attempt -eq $max_attempts ]; then
      echo "✗ mesahub-server failed to start after ${max_attempts}s"
      kill $MESAHUB_PID 2>/dev/null || true
      exit 1
    fi
    sleep 1
  done
  echo "✓ mesahub-server ready on :$MESAHUB_CORE_PORT"

  # Create the application DB (idempotent — 409 just means it already exists)
  curl -sf -X POST "http://localhost:${MESAHUB_CORE_PORT}/api/db" \
    -H "Authorization: Bearer $_ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${_DBNAME}\",\"slug\":\"${_DBNAME}\",\"owner\":\"system\"}" > /dev/null 2>&1 || true
  echo "✓ Database '${_DBNAME}' ready"

  # Rewrite MESAHUB_URL with the resolved token so the Node process can parse it
  export MESAHUB_URL="mh://${_ADMIN_TOKEN}@localhost:${MESAHUB_CORE_PORT}/${_DBNAME}"
else
  echo "[0/5] External mesahub at $_HOST (db: $_DBNAME) — skipping bundled server"
fi

if [ "${ENABLE_TEST_MODE:-false}" = "true" ]; then
  _MP_USER="${MAILPIT_USER:-root}"
  _MP_PASS="${MAILPIT_PASS:-${ADMIN_TOKEN}}"
  echo "[1/5] Starting Mailpit (SMTP :$MAILPIT_SMTP_PORT, UI :$MAILPIT_UI_PORT, user: $_MP_USER)..."
  
  # Create auth file for mailpit
  mkdir -p /tmp/mailpit
  echo "${_MP_USER}:${_MP_PASS}" > /tmp/mailpit/auth.txt
  chmod 600 /tmp/mailpit/auth.txt
  
  mailpit \
    --smtp "0.0.0.0:${MAILPIT_SMTP_PORT}" \
    --listen "0.0.0.0:${MAILPIT_UI_PORT}" \
    --webroot /mailpit \
    --ui-auth-file /tmp/mailpit/auth.txt &
  MAILPIT_PID=$!

  echo "[2/5] Waiting for Mailpit to be ready..."
  max_attempts=15
  attempt=0
  until curl -sf -u "${_MP_USER}:${_MP_PASS}" "http://localhost:${MAILPIT_UI_PORT}/mailpit/api/v1/info" > /dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ $attempt -eq $max_attempts ]; then
      echo "✗ Mailpit failed to start after ${max_attempts}s"
      kill $MAILPIT_PID 2>/dev/null || true
      exit 1
    fi
    sleep 1
  done
  echo "✓ Mailpit ready on http://localhost:${PORT}/mailpit/"
else
  echo "[1/5] Mailpit skipped (set ENABLE_TEST_MODE=true to enable)"
fi

echo "[3/5] Starting backend on port $BACKEND_PORT..."
PORT=$BACKEND_PORT node /app/backend/dist/index.js &
BACKEND_PID=$!

echo "Waiting for backend to be ready..."
max_attempts=30
attempt=0
until curl -sf http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ $attempt -eq $max_attempts ]; then
    echo "✗ Backend failed to start after ${max_attempts}s"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done
echo "✓ Backend ready on port $BACKEND_PORT"

echo "[4/5] Starting Caddy on port $PORT..."

echo "--- Static files in /usr/share/caddy ---"
ls /usr/share/caddy/
echo "--- Assets ---"
ls /usr/share/caddy/assets/ 2>/dev/null || echo "NO ASSETS DIR FOUND"
echo "----------------------------------------"

if [ "${ENABLE_TEST_MODE:-false}" = "true" ]; then
  MAILPIT_CADDY_BLOCK="
  handle /mailpit* {
    reverse_proxy localhost:${MAILPIT_UI_PORT}
  }
"
else
  MAILPIT_CADDY_BLOCK=""
fi

cat > /tmp/Caddyfile <<EOF
{
  auto_https off
  admin off
}

:$PORT {
  root * /usr/share/caddy

  handle /health {
    reverse_proxy localhost:${BACKEND_PORT}
  }

  handle /api/* {
    reverse_proxy localhost:${BACKEND_PORT}
  }

  handle /v1/* {
    reverse_proxy localhost:${BACKEND_PORT}
  }

${MAILPIT_CADDY_BLOCK}
  handle {
    root * /usr/share/caddy
    try_files {path} /index.html
    file_server
  }
}
EOF

caddy fmt --overwrite /tmp/Caddyfile

echo "--- Generated Caddyfile ---"
cat /tmp/Caddyfile
echo "---------------------------"

caddy run --config /tmp/Caddyfile

