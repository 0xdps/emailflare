# Recipes

Quick reference for all `just` commands. Run any recipe with `just <name>`.

> **Prerequisites:** Docker running, `pnpm` installed, and the relevant `.env` file in place (see below).

---

## Shared

### `just install`
Install dependencies for every service. Run this once after cloning or after adding a new service.

```sh
just install
```

### `just emailflare-emails-build`
Rebuild the shared `services/emails` package. Required after editing any file under `services/emails/src/`.

```sh
just emailflare-emails-build
```

### `just emailflare-status`
Show running containers across all four stacks (Email API dev, Email API prod, Inbox dev, Inbox prod).

```sh
just emailflare-status
```

### `just emailflare-doctor`
Verify Docker is running and the Email API env file (`.env.api.local`) exists.

```sh
just emailflare-doctor
```

---

## emailflare-api — Docker

Env file: `.env.api.local` (copy from `.env.api.example`).

### `just emailflare-api-dev`
Start the dev stack with hot reload. Runs MesaHub, email-server, email-ui (Vite), and Mailpit.

```sh
just emailflare-api-dev
```

Open `http://localhost:8090` for the dashboard, `http://localhost:8025` for Mailpit.

### `just emailflare-api-dev-down`
Stop the dev stack.

```sh
just emailflare-api-dev-down
```

### `just emailflare-api-up`
Build and start the production stack in the background.

```sh
just emailflare-api-up
```

### `just emailflare-api-down`
Stop the production stack.

```sh
just emailflare-api-down
```

### `just emailflare-api-logs`
Tail live logs from the production stack.

```sh
just emailflare-api-logs
```

### `just emailflare-api-smoke`
Quick health + auth smoke test against a running stack. Reads `ADMIN_TOKEN` and `PORT` from `.env.api.local`.

```sh
just emailflare-api-smoke
```

---

## emailflare-api-worker — Cloudflare Worker

Uses `services/email-worker` (D1 + KV) deployed to the Cloudflare edge.

### `just emailflare-api-worker-login`
Authenticate the `wrangler` CLI with Cloudflare (opens browser).

```sh
just emailflare-api-worker-login
```

### `just emailflare-api-worker-setup`
First-time setup. Creates D1 + KV, runs migrations, sets secrets, deploys the Worker and email-ui assets. Run once per environment.

```sh
# Copy config first
cp scripts/config.example.toml scripts/config.toml
# Fill in scripts/config.toml, then:
just emailflare-api-worker-setup
```

### `just emailflare-api-worker-update`
Apply any pending D1 migrations and redeploy the Worker in one step. Use for ongoing updates.

```sh
just emailflare-api-worker-update
```

### `just emailflare-api-worker-dev`
Start a local Worker dev server with local D1/KV stubs. Builds `email-ui` first if `dist/` is missing.

```sh
just emailflare-api-worker-dev
```

For live UI editing, run this in a second terminal:

```sh
just emailflare-api-worker-dev-ui
```

### `just emailflare-api-worker-dev-ui`
Start the email-ui Vite dev server. Proxies `/api` to the wrangler dev server on `:8787`.

```sh
just emailflare-api-worker-dev-ui
```

### `just emailflare-api-worker-localflare [port]`
Start the Localflare sidecar for local Cloudflare bindings. Defaults to port `8790`.

```sh
just emailflare-api-worker-localflare           # port 8790
just emailflare-api-worker-localflare 8787      # explicit port
```

### `just emailflare-api-worker-secret <NAME>`
Set or rotate a Worker secret interactively (value is never echoed).

```sh
just emailflare-api-worker-secret ADMIN_TOKEN
just emailflare-api-worker-secret SESSION_SECRET
```

### `just emailflare-api-worker-rollout`
Upload a new Worker version for a gradual traffic rollout. After uploading, use `wrangler versions deploy` to shift traffic percentage.

```sh
just emailflare-api-worker-rollout
```

### `just emailflare-api-worker-remove`
Tear down all Email API Cloudflare resources: the Worker, its D1 database, and its KV namespace. Safe to re-run.

```sh
just emailflare-api-worker-remove
```

---

## emailflare-inbox — Cloudflare Worker

Uses `services/inbox-worker` (D1 + R2 + KV + Durable Objects + Queue).

### `just emailflare-inbox-deploy`
First-time setup. Creates all CF resources (D1, KV, R2, Queue), patches `wrangler.jsonc`, runs migrations, builds `inbox-ui`, and deploys. Idempotent — safe to re-run.

```sh
# Optionally pre-fill config:
cp scripts/config.example.toml scripts/config.toml
# Then deploy:
just emailflare-inbox-deploy
```

### `just emailflare-inbox-dev`
Start a local inbox Worker dev server with local stubs. Builds `inbox-ui` first if `dist/` is missing.

```sh
just emailflare-inbox-dev
```

For live UI editing, run in a second terminal:

```sh
just emailflare-inbox-dev-ui
```

### `just emailflare-inbox-dev-ui`
Start the inbox-ui Vite dev server. Proxies `/api` and `/v1` to wrangler dev on `:8787`.

```sh
just emailflare-inbox-dev-ui
```

### `just emailflare-inbox-update`
Apply pending D1 migrations, rebuild inbox-ui, and redeploy the Worker. Use for ongoing updates.

```sh
just emailflare-inbox-update
```

### `just emailflare-inbox-build-ui`
Build `inbox-ui` without deploying (useful to pre-build before `emailflare-inbox-dev`).

```sh
just emailflare-inbox-build-ui
```

### `just emailflare-inbox-secret <NAME>`
Set or rotate an inbox Worker secret interactively.

```sh
just emailflare-inbox-secret SESSION_SECRET
just emailflare-inbox-secret VAPID_PRIVATE_KEY
```

---

## emailflare-inbox — Node.js Server (Docker)

Env files: `.env.inbox` (production), `.env.inbox.local` (dev).

Runs MesaHub + Redis + inbox-server + inbox-ui + Caddy.

### `just emailflare-inbox-server-dev`
Start the full Docker dev stack with hot reload.

```sh
just emailflare-inbox-server-dev
```

Open `http://localhost:8091`.

### `just emailflare-inbox-server-dev-down`
Stop the dev stack.

```sh
just emailflare-inbox-server-dev-down
```

### `just emailflare-inbox-server-up`
Build and start the production inbox stack in the background.

```sh
just emailflare-inbox-server-up
```

### `just emailflare-inbox-server-down`
Stop the production inbox stack.

```sh
just emailflare-inbox-server-down
```

### `just emailflare-inbox-server-logs`
Tail live logs from the production inbox stack.

```sh
just emailflare-inbox-server-logs
```

### `just emailflare-inbox-standalone-deploy`
First-time deploy of the R2 bucket and `emailflare-inbox-bridge` CF Worker for the standalone (Docker) setup.

```sh
just emailflare-inbox-standalone-deploy
```

### `just emailflare-inbox-bridge-secret <NAME>`
Set or rotate a secret on the `emailflare-inbox-bridge` CF Worker.

```sh
just emailflare-inbox-bridge-secret WEBHOOK_SECRET
```

---

## Cloudflare Bridges

Thin CF Workers that sit in front of Docker/VPS deployments to receive Cloudflare Email Routing events and forward them to your servers.

- **emailflare-api-bridge** — bounces/complaints → `POST /api/webhooks/bounce` on email-server
- **emailflare-inbox-bridge** — inbound email → `POST /webhook/email` on inbox-server

### `just emailflare-bridge-setup`
Interactive first-time setup. Asks which bridges to deploy, collects server URLs and webhook secrets, then prints the Email Routing rules to add in the Cloudflare dashboard.

```sh
just emailflare-bridge-setup
```

### `just emailflare-api-bridge-secret <NAME>`
Set or rotate a secret on the `emailflare-api-bridge` CF Worker.

```sh
just emailflare-api-bridge-secret WEBHOOK_SECRET
```

### `just emailflare-api-bridge-update`
Redeploy the latest `emailflare-api-bridge` code without changing any config.

```sh
just emailflare-api-bridge-update
```

### `just emailflare-inbox-bridge-update`
Redeploy the latest `emailflare-inbox-bridge` code without changing any config.

```sh
just emailflare-inbox-bridge-update
```

---

## Landing Page

### `just emailflare-web`
Start the Astro landing page dev server (`services/landing/`).

```sh
just emailflare-web
```

---

## Common workflows

**First time (Docker / Email API)**
```sh
just emailflare-doctor
just install
just emailflare-api-dev
```

**First time (Cloudflare Worker / Email API)**
```sh
cp scripts/config.example.toml scripts/config.toml
# fill in config.toml
just emailflare-api-worker-login
just emailflare-api-worker-setup
```

**First time (Docker / Inbox)**
```sh
cp .env.inbox.example .env.inbox.local   # fill in values
just emailflare-inbox-server-dev
```

**First time (Cloudflare Worker / Inbox)**
```sh
just emailflare-inbox-deploy
```

**Deploy an update (Cloudflare Worker)**
```sh
just emailflare-api-worker-update    # Email API Worker
just emailflare-inbox-update         # Inbox Worker
```

**Rotate a secret**
```sh
just emailflare-api-worker-secret ADMIN_TOKEN
just emailflare-inbox-secret SESSION_SECRET
```
