# EmailFlare · task runner
#
# Products:
#   emailflare-api    — transactional email sending  (services/email-worker + services/email-server)
#   emailflare-inbox  — hosted email inboxes         (services/inbox-worker  + services/inbox-server)
#
# Deployment targets per product:
#   CF Worker  — edge, zero-ops, D1 + KV (+ R2/DO/Queues for inbox)
#   Docker     — any VPS/VM, full control, embedded SQLite via MesaHub

ENV_FILE     := ".env.api.local"
INBOX_ENV    := ".env.inbox"
INBOX_DEV_ENV:= ".env.inbox.local"

# List all recipes
default:
    @just --list

# ============================================================================
# SHARED
# ============================================================================

# Install deps for all services (run after clone or adding a new service)
install:
    pnpm install --dir packages/email-core
    pnpm install --dir packages/inbox-core
    pnpm install --dir scripts
    pnpm install --dir services/emails
    cd services/emails && pnpm run build
    pnpm install --dir services/email-worker
    pnpm install --dir services/email-ui
    pnpm install --dir services/email-server
    pnpm install --dir services/inbox-worker
    pnpm install --dir services/inbox-ui
    pnpm install --dir services/inbox-server
    pnpm install --dir services/inbox-bridge
    pnpm install --dir services/email-bridge

# Rebuild the shared emails package (run after editing services/emails/src/)
emailflare-emails-build:
    cd services/emails && pnpm run build

# Show running containers across all stacks
emailflare-status:
    #!/usr/bin/env bash
    echo "=== Email API dev stack ==="
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.email-api.dev.yaml ps 2>/dev/null || echo "(not running)"
    echo ""
    echo "=== Email API prod stack ==="
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.email-api.yaml ps 2>/dev/null || echo "(not running)"
    echo ""
    echo "=== Inbox dev stack ==="
    env -i PATH="$PATH" docker compose -f compose.email-inbox.dev.yaml ps 2>/dev/null || echo "(not running)"
    echo ""
    echo "=== Inbox prod stack ==="
    env -i PATH="$PATH" docker compose -f compose.email-inbox.yaml ps 2>/dev/null || echo "(not running)"

# Quick health + auth smoke-test (auto-detects dev or prod port via ENV_FILE)
emailflare-api-smoke:
    #!/usr/bin/env bash
    set -euo pipefail
    [ -f {{ENV_FILE}} ] || { echo "{{ENV_FILE}} missing"; exit 1; }
    ADMIN_TOKEN=$(grep -E '^ADMIN_TOKEN=' {{ENV_FILE}} | head -n1 | cut -d= -f2-)
    PORT=${PORT:-8090}
    BASE_URL="http://localhost:$PORT"
    echo "Checking $BASE_URL ..."
    code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/health")
    [ "$code" = "200" ] || { echo "/health returned $code"; exit 1; }
    code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/auth/me" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    [ "$code" = "200" ] || { echo "/api/auth/me returned $code"; exit 1; }
    echo "smoke checks passed"

# Verify Docker is running and required env files exist
emailflare-doctor:
    #!/usr/bin/env bash
    set -euo pipefail
    command -v docker >/dev/null 2>&1 || { echo "docker is required"; exit 1; }
    docker info >/dev/null 2>&1 || { echo "Docker daemon is not running"; exit 1; }
    [ -f {{ENV_FILE}} ] || { echo "{{ENV_FILE}} missing — copy .env.example and fill in values"; exit 1; }
    echo "doctor: all good"

# ============================================================================
# EMAILFLARE-API · DOCKER  (email-server + email-ui + Caddy)
# ============================================================================

# Start dev stack with hot reload (MesaHub + email-server + email-ui)
emailflare-api-dev:
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.email-api.dev.yaml up --build

# Stop dev stack
emailflare-api-dev-down:
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.email-api.dev.yaml down

# Build + start production stack
emailflare-api-up:
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.email-api.yaml up --build -d

# Stop production stack
emailflare-api-down:
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.email-api.yaml down

# Tail production logs
emailflare-api-logs:
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.email-api.yaml logs -f

# ============================================================================
# EMAILFLARE-API-WORKER · CLOUDFLARE WORKER  (email-worker + email-ui on the edge)
# ============================================================================

# Authenticate wrangler with Cloudflare (opens browser)
emailflare-api-worker-login:
    cd services/email-worker && npx wrangler login

# First-time setup: creates D1 + KV, runs migrations, sets secrets, deploys.
# Copy scripts/config.example.toml → scripts/config.toml before running.
emailflare-api-worker-setup:
    node scripts/setup.mjs

# Apply pending D1 migrations and deploy the latest Worker code (atomic)
emailflare-api-worker-update:
    cd services/email-worker && pnpm run cf:update

# Start local Worker dev server with local D1 + KV stubs.
# Builds email-ui once if dist/ is missing (wrangler needs the assets dir).
# For live UI editing run `just emailflare-api-worker-dev-ui` in a second terminal.
emailflare-api-worker-dev:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ ! -d services/email-ui/dist ]; then
        echo "email-ui/dist missing — building first…"
        cd services/email-ui && pnpm install --frozen-lockfile && pnpm build
        cd "$OLDPWD"
    fi
    # Generate gitignored wrangler.jsonc from the tracked template if missing.
    if [ ! -f services/email-worker/wrangler.jsonc ]; then
        echo "wrangler.jsonc missing — generating from wrangler.example.jsonc…"
        cp services/email-worker/wrangler.example.jsonc services/email-worker/wrangler.jsonc
    fi
    cd services/email-worker && npx wrangler dev

# Start email-ui Vite dev server (proxies /api to wrangler dev on :8787)
emailflare-api-worker-dev-ui:
    cd services/email-ui && pnpm dev

# Start Localflare sidecar for local Cloudflare bindings.
# Defaults to port 8790 to avoid colliding with wrangler dev on 8787.
# Usage: just emailflare-api-worker-localflare          # port 8790
#        just emailflare-api-worker-localflare 8787     # explicit override
emailflare-api-worker-localflare port='8790':
    cd services/email-worker && npx localflare --port {{port}}

# Update a Worker secret interactively.
# Usage: just emailflare-api-worker-secret SECRET_NAME
emailflare-api-worker-secret name:
    #!/usr/bin/env sh
    printf '{{name}}: '; stty -echo; read val; stty echo; echo
    echo "$val" | npx wrangler secret put {{name}} --cwd services/email-worker

# Upload a new Worker version for gradual traffic rollout.
# After this, use `wrangler versions deploy` to shift traffic percentage.
emailflare-api-worker-rollout:
    cd services/email-worker && pnpm run cf:rollout

# Tear down all Worker CF resources (Worker + D1 + KV). Safe to re-run.
emailflare-api-worker-remove:
    #!/usr/bin/env bash
    set -euo pipefail

    WORKER_NAME="emailflare-api-worker"
    D1_NAME="emailflare"
    KV_ID="$(node -e 'const fs=require("node:fs"); const p="services/email-worker/wrangler.jsonc"; if(!fs.existsSync(p)){process.stdout.write("");process.exit(0);} const src=fs.readFileSync(p,"utf8"); const cfg=Function(`"use strict"; return (${src});`)(); process.stdout.write(cfg.kv_namespaces?.[0]?.id ?? "");')"

    echo "Removing Email API Worker resources..."

    if [ -n "${WORKER_NAME:-}" ]; then
        echo "  Worker: ${WORKER_NAME}"
        npx wrangler delete "${WORKER_NAME}" --force --cwd services/email-worker || true
    else
        echo "  Worker: skipped (name not found)"
    fi

    if [ -n "${D1_NAME:-}" ]; then
        echo "  D1: ${D1_NAME}"
        npx wrangler d1 delete "${D1_NAME}" --skip-confirmation --cwd services/email-worker || true
    else
        echo "  D1: skipped (database_name not found)"
    fi

    if [ -n "${KV_ID:-}" ]; then
        echo "  KV: ${KV_ID}"
        npx wrangler kv namespace delete --namespace-id "${KV_ID}" --skip-confirmation --cwd services/email-worker || true
    else
        echo "  KV: skipped (no generated wrangler.jsonc — run setup first, or delete the emailflare-api-rate-limit namespace manually)"
    fi

    echo "Done."

# ============================================================================
# WIPE EVERYTHING  (all CF Workers, D1, KV, R2, Queues — fresh-start teardown)
# ============================================================================

# Delete every Cloudflare resource across both products for a clean-slate redeploy.
# Destructive — prompts for confirmation. Pass `all` to also wipe the two bridges.
emailflare-wipe scope='':
    #!/usr/bin/env bash
    set -euo pipefail

    SCOPE="${1:-${SCOPE:-}}"

    echo "======================================================"
    echo "  EmailFlare — WIPE ALL CLOUDFLARE RESOURCES"
    echo "======================================================"
    echo "This will DELETE:"
    echo "  • Workers : emailflare-api-worker, emailflare-inbox-worker"
    echo "  • D1      : emailflare (shared database)"
    echo "  • KV      : emailflare-api-rate-limit, emailflare-inbox-rate-limit"
    echo "  • R2      : emailflare-inbox-attachments"
    echo "  • Queue   : emailflare-inbox-sequences"
    if [ "${SCOPE}" = "all" ]; then
        echo "  • Bridges : emailflare-api-bridge, emailflare-inbox-bridge"
    fi
    echo "======================================================"
    read -r -p "Type 'DELETE' to confirm: " confirm
    if [ "${confirm}" != "DELETE" ]; then
        echo "Aborted."
        exit 0
    fi

    delete_worker() {
        local name="$1"
        local cwd="$2"
        echo "  → Worker: ${name}"
        npx wrangler delete "${name}" --force --cwd "${cwd}" 2>/dev/null || echo "     (skipped / not found)"
    }

    # ── Workers ───────────────────────────────────────────────────────────
    delete_worker "emailflare-api-worker"   "services/email-worker"
    delete_worker "emailflare-inbox-worker" "services/inbox-worker"

    if [ "${SCOPE}" = "all" ]; then
        delete_worker "emailflare-api-bridge"   "services/email-bridge"
        delete_worker "emailflare-inbox-bridge" "services/inbox-bridge"
    fi

    # ── D1 (shared) ───────────────────────────────────────────────────────
    echo "  → D1: emailflare"
    npx wrangler d1 delete emailflare --skip-confirmation --cwd services/email-worker 2>/dev/null \
        || echo "     (skipped / not found)"

    # ── KV namespaces ─────────────────────────────────────────────────────
    for kv in "emailflare-api-rate-limit" "emailflare-inbox-rate-limit"; do
        echo "  → KV: ${kv}"
        npx wrangler kv namespace delete --namespace-id "${kv}" --skip-confirmation --cwd services/email-worker 2>/dev/null \
            || echo "     (skipped / not found)"
    done

    # ── R2 bucket ─────────────────────────────────────────────────────────
    echo "  → R2: emailflare-inbox-attachments"
    npx wrangler r2 bucket delete emailflare-inbox-attachments --cwd services/inbox-worker 2>/dev/null \
        || echo "     (skipped / not found)"

    # ── Queue ─────────────────────────────────────────────────────────────
    echo "  → Queue: emailflare-inbox-sequences"
    npx wrangler queues delete emailflare-inbox-sequences --cwd services/inbox-worker 2>/dev/null \
        || echo "     (skipped / not found)"

    echo ""
    echo "Wipe complete. Run a fresh deploy with:"
    echo "  just emailflare-api-worker-setup"
    echo "  just emailflare-inbox-deploy"
    echo "  just emailflare-bridge-setup        # if you wiped bridges (scope=all)"

# ============================================================================
# EMAILFLARE-INBOX · CLOUDFLARE WORKER  (inbox-worker + inbox-ui, D1 + R2 + KV + DO)
# ============================================================================

# First-time setup: creates D1, KV, R2, Queue, patches wrangler.jsonc,
# runs migrations, sets secrets, builds inbox-ui, deploys. Idempotent.
# Optionally copy scripts/config.example.toml → scripts/config.toml first.
emailflare-inbox-deploy:
    node scripts/deploy-inbox.mjs

# Start local inbox Worker dev server.
# Builds inbox-ui once if dist/ is missing (wrangler needs the assets dir).
# For live UI editing run `just emailflare-inbox-dev-ui` in a second terminal.
emailflare-inbox-dev:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ ! -d services/inbox-ui/dist ]; then
        echo "inbox-ui/dist missing — building first…"
        cd services/inbox-ui && pnpm install --frozen-lockfile && pnpm build
        cd "$OLDPWD"
    fi
    # Generate gitignored wrangler.jsonc from the tracked template if missing.
    if [ ! -f services/inbox-worker/wrangler.jsonc ]; then
        echo "wrangler.jsonc missing — generating from wrangler.example.jsonc…"
        cp services/inbox-worker/wrangler.example.jsonc services/inbox-worker/wrangler.jsonc
    fi
    cd services/inbox-worker && npx wrangler dev

# Start inbox-ui Vite dev server (proxies /api and /v1 to wrangler dev on :8787)
emailflare-inbox-dev-ui:
    cd services/inbox-ui && pnpm dev

# Apply pending D1 migrations, rebuild inbox-ui, and deploy the Worker
emailflare-inbox-update:
    cd services/inbox-worker && npx wrangler d1 migrations apply emailflare --remote
    cd services/inbox-ui && pnpm build
    cd services/inbox-worker && npx wrangler deploy

# Set up Cloudflare Email Routing locally (with full API diagnostics).
# Usage: just emailflare-inbox-routing              (prompts for domain)
#        just emailflare-inbox-routing example.com  (optional domain arg)
emailflare-inbox-routing domain='':
    node scripts/setup-email-routing.mjs {{if domain != '' { '--domain ' + domain } else { '' }}}

# Build inbox-ui only (without deploying)
emailflare-inbox-build-ui:
    cd services/inbox-ui && pnpm install --frozen-lockfile && pnpm build

# Update an inbox Worker secret interactively.
# Usage: just emailflare-inbox-secret SESSION_SECRET
emailflare-inbox-secret name:
    #!/usr/bin/env sh
    printf '{{name}}: '; stty -echo; read val; stty echo; echo
    echo "$val" | npx wrangler secret put {{name}} --cwd services/inbox-worker

# ============================================================================
# EMAILFLARE-INBOX · NODE.JS SERVER  (inbox-server + inbox-ui + Caddy + MesaHub + Redis)
# ============================================================================

# Start full Docker dev stack: MesaHub + Redis + inbox-server (hot reload) + inbox-ui (Vite) + Caddy
emailflare-inbox-server-dev:
    env -i PATH="$PATH" docker compose --env-file {{INBOX_DEV_ENV}} -f compose.email-inbox.dev.yaml up --build

# Stop dev stack
emailflare-inbox-server-dev-down:
    env -i PATH="$PATH" docker compose -f compose.email-inbox.dev.yaml down

# Build + start production stack
emailflare-inbox-server-up:
    env -i PATH="$PATH" docker compose --env-file {{INBOX_ENV}} -f compose.email-inbox.yaml up --build -d

# Stop production stack
emailflare-inbox-server-down:
    env -i PATH="$PATH" docker compose -f compose.email-inbox.yaml down

# Tail production logs
emailflare-inbox-server-logs:
    env -i PATH="$PATH" docker compose -f compose.email-inbox.yaml logs -f

# First-time standalone deploy: R2 bucket + inbox-bridge CF Worker
emailflare-inbox-standalone-deploy:
    node scripts/deploy-inbox-standalone.mjs

# Update an inbox-bridge Worker secret interactively.
# Usage: just emailflare-inbox-bridge-secret WEBHOOK_SECRET
emailflare-inbox-bridge-secret name:
    #!/usr/bin/env sh
    printf '{{name}}: '; stty -echo; read val; stty echo; echo
    echo "$val" | npx wrangler secret put {{name}} --cwd services/inbox-bridge

# ============================================================================
# CLOUDFLARE BRIDGES  (thin CF Workers for Docker/VPS deployments)
# ============================================================================
#
# Docker/VPS users still need Cloudflare Email Routing to receive inbound mail.
# These thin bridge Workers receive email and forward it to your servers:
#
#   emailflare-api-bridge   — bounces/complaints → POST /api/webhooks/bounce on email-server
#   emailflare-inbox-bridge — inbound email      → POST /webhook/email on inbox-server
#
# Deploy one or both. Interactive — asks for server URLs and webhook secrets.

# First-time setup: deploy emailflare-api-bridge and/or emailflare-inbox-bridge CF Workers.
# Asks which to deploy, collects server URLs + secrets, then prints
# the CF Email Routing rules to create in the Cloudflare dashboard.
emailflare-bridge-setup:
    node scripts/setup-cf-workers.mjs

# Update an emailflare-api-bridge secret interactively.
# Usage: just emailflare-api-bridge-secret WEBHOOK_SECRET
emailflare-api-bridge-secret name:
    #!/usr/bin/env sh
    printf '{{name}}: '; stty -echo; read val; stty echo; echo
    echo "$val" | npx wrangler secret put {{name}} --cwd services/email-bridge

# Redeploy emailflare-api-bridge (no config changes, just push latest code)
emailflare-api-bridge-update:
    cd services/email-bridge && npx wrangler deploy

# Redeploy emailflare-inbox-bridge (no config changes, just push latest code)
emailflare-inbox-bridge-update:
    cd services/inbox-bridge && npx wrangler deploy

# ============================================================================
# LANDING PAGE  (services/landing/ — Astro, deployed to Cloudflare Pages)
# ============================================================================

# Start landing page dev server
emailflare-web:
    cd services/landing && pnpm dev
