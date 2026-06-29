# EmailFlare Task Runner

ENV_FILE := ".env.local"

# Default recipe
default:
    @just --list

# ============================================================================
# DEVELOPMENT  (compose.dev.yaml — embedded mesahub, hot reload)
# ============================================================================

# Start full dev stack (mesahub + backend + admin + edge)
dev:
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.dev.yaml up --build

# Start dev stack in background
dev-bg:
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.dev.yaml up --build -d

# Stop dev stack
dev-down:
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.dev.yaml down

# Reset dev stack (wipe volumes and rebuild)
dev-reset:
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.dev.yaml down -v
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.dev.yaml up --build

# Stream logs (backend + admin)
logs:
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.dev.yaml logs -f backend admin

# Stream a single service log: just logs-svc mesahub
logs-svc service:
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.dev.yaml logs -f {{service}}

# ============================================================================
# PRODUCTION  (compose.yaml — single bundled container)
# ============================================================================

# Start production container
prod:
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.yaml up --build -d

# Stop production container
prod-down:
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.yaml down

# Reset production (wipe data volume and rebuild)
prod-reset:
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.yaml down -v
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.yaml up --build -d

# Stream production logs
prod-logs:
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.yaml logs -f

# Build production image only (no start)
build:
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.yaml build app

# ============================================================================
# STATUS & SMOKE
# ============================================================================

# Show running containers for both stacks
status:
    #!/usr/bin/env bash
    echo "=== Dev stack ==="
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.dev.yaml ps 2>/dev/null || echo "(not running)"
    echo ""
    echo "=== Prod stack ==="
    env -i PATH="$PATH" docker compose --env-file {{ENV_FILE}} -f compose.yaml ps 2>/dev/null || echo "(not running)"

# Quick health + auth smoke check (auto-detects dev or prod port)
smoke:
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

# Validate Docker is available and .env exists
doctor:
    #!/usr/bin/env bash
    set -euo pipefail
    command -v docker >/dev/null 2>&1 || { echo "docker is required"; exit 1; }
    docker info >/dev/null 2>&1 || { echo "Docker daemon is not running"; exit 1; }
    [ -f {{ENV_FILE}} ] || { echo "{{ENV_FILE}} missing — copy .env.example to .env.local and fill in values"; exit 1; }
    echo "doctor: all good"

# ============================================================================
# CLOUDFLARE WORKER  (services/worker/)
# ============================================================================

# Authenticate with Cloudflare (opens browser)
worker-login:
    cd services/worker && npx wrangler login

# Install all dependencies (scripts + emails + worker + admin + backend)
install:
    pnpm install --dir scripts
    pnpm install --dir services/emails
    cd services/emails && pnpm run build
    pnpm install --dir services/worker
    pnpm install --dir services/admin
    pnpm install --dir services/backend

# Build the shared emails package (re-run after editing services/emails/src/)
emails-build:
    cd services/emails && pnpm run build

# First-time setup: creates D1 + KV, patches wrangler.jsonc, applies migrations,
# prompts for secrets, and deploys. Safe to re-run (idempotent).
# Copy scripts/config.example.toml → scripts/config.toml before running.
worker-setup:
    node scripts/setup.mjs

# Tear down Worker resources (Worker + D1 + KV) using values from wrangler.jsonc.
# Safe to re-run: missing resources are skipped.
remove-worker:
    #!/usr/bin/env bash
    set -euo pipefail

    WORKER_NAME="$(node -e 'const fs=require("node:fs"); const src=fs.readFileSync("services/worker/wrangler.jsonc", "utf8"); const cfg=Function(`"use strict"; return (${src});`)(); process.stdout.write(cfg.name ?? "");')"
    D1_NAME="$(node -e 'const fs=require("node:fs"); const src=fs.readFileSync("services/worker/wrangler.jsonc", "utf8"); const cfg=Function(`"use strict"; return (${src});`)(); process.stdout.write(cfg.d1_databases?.[0]?.database_name ?? "");')"
    KV_ID="$(node -e 'const fs=require("node:fs"); const src=fs.readFileSync("services/worker/wrangler.jsonc", "utf8"); const cfg=Function(`"use strict"; return (${src});`)(); process.stdout.write(cfg.kv_namespaces?.[0]?.id ?? "");')"

    echo "Removing Cloudflare Worker components..."

    if [ -n "${WORKER_NAME:-}" ]; then
        echo "- Worker: ${WORKER_NAME}"
        npx wrangler delete "${WORKER_NAME}" --force --cwd services/worker || true
    else
        echo "- Worker: skipped (name not found in wrangler.jsonc)"
    fi

    if [ -n "${D1_NAME:-}" ]; then
        echo "- D1: ${D1_NAME}"
        npx wrangler d1 delete "${D1_NAME}" --skip-confirmation --cwd services/worker || true
    else
        echo "- D1: skipped (database_name not found in wrangler.jsonc)"
    fi

    if [ -n "${KV_ID:-}" ]; then
        echo "- KV namespace id: ${KV_ID}"
        npx wrangler kv namespace delete --namespace-id "${KV_ID}" --skip-confirmation --cwd services/worker || true
    else
        echo "- KV: skipped (id not found in wrangler.jsonc)"
    fi

    echo "Done."

# Apply pending D1 migrations then deploy latest code (atomic update)
worker-update:
    cd services/worker && pnpm run cf:update

# Start local Worker dev server (uses local D1 + KV stubs)
worker-dev:
    cd services/worker && pnpm dev

# Start Localflare dashboard + worker sidecar for local Cloudflare bindings.
# Defaults to port 8790 to avoid collisions with wrangler dev on 8787.
# Usage: just localflare              # uses 8790
#        just localflare 8787         # explicit port override
localflare port='8790':
    cd services/worker && npx localflare --port {{port}}

# Update a Worker secret interactively.
# Usage: just worker-secret SECRET_NAME
# e.g.   just worker-secret CF_API_TOKEN
worker-secret name:
    #!/usr/bin/env sh
    printf '{{name}}: '; stty -echo; read val; stty echo; echo
    echo "$val" | npx wrangler secret put {{name}} --cwd services/worker

# Upload a new Worker version (migration + version upload) for gradual rollout.
# After this, use `wrangler versions deploy` to control traffic percentage.
worker-rollout-upload:
    cd services/worker && pnpm run cf:rollout

# ============================================================================
# LANDING PAGE  (services/landing/)
# ============================================================================

# Start landing page dev server
web:
    cd services/landing && pnpm dev

