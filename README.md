<p align="center">
  <img src="./services/email-ui/public/favicon.svg" width="64" height="64" alt="EmailFlare logo" />
</p>

# EmailFlare

EmailFlare is a self-hosted email platform with two independent services that work together:

- **emailflare-api** — transactional email sending API with an admin dashboard (domains, templates, API keys, logs)
- **emailflare-inbox** — team inbox and lightweight CRM (receive, thread, reply, sequences, multi-user)

Both services are built around Cloudflare Email Sending, use SQLite-backed storage via embedded [mesahub-core](https://github.com/mesahub-db/mesahub-core), and are designed for minimum infrastructure — each runs as a single Docker container with one persistent volume.

---

## emailflare-api · Email Sending API

A Hono API for sending transactional email via the Cloudflare Email Sending API, with a React admin panel for managing domains, templates, API keys, and logs.

**Docker image**

```text
ghcr.io/0xdps/emailflare-api:latest
```

**Quick start**

```bash
cp .env.api.example .env.local
# fill in SESSION_SECRET, ADMIN_TOKEN, CF_API_TOKEN, CF_ACCOUNT_ID

docker compose --env-file .env.local -f compose.email-api.yaml up -d
```

Open `http://localhost:8090`.

**Cloudflare Worker deployment** (no Docker, edge-native)

```bash
just install
cp scripts/config.example.toml scripts/config.toml
# fill in your values
just emailflare-api-worker-setup
```

Read the full guide: [docs/CLOUDFLARE.md](./docs/CLOUDFLARE.md)

**Railway**

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/emailflare)

---

## emailflare-inbox · Team Inbox & CRM

A Node.js inbox server with a React dashboard for receiving inbound email via Cloudflare Email Routing, threading conversations, replying, running sequences, and managing contacts across a team.

**Docker image**

```text
ghcr.io/0xdps/emailflare-inbox:latest
```

**Quick start**

```bash
cp .env.inbox.example .env.inbox.local
# fill in SESSION_SECRET, WEBHOOK_SECRET, CF_API_TOKEN, CF_ACCOUNT_ID, REDIS_URL

docker compose --env-file .env.inbox.local -f compose.email-inbox.yaml up -d
```

Open `http://localhost:8091`.

**Cloudflare Worker deployment** (inbox-worker + inbox-bridge)

```bash
just install
cp scripts/config.example.toml scripts/config.toml
# fill in your values
just emailflare-inbox-deploy
```

Read the full guide: [docs/CLOUDFLARE.md](./docs/CLOUDFLARE.md)

---

## What ships in this repo

**Email API**
- `services/email-server` — Hono API: domains, templates, keys, stats, send
- `services/email-ui` — React admin panel (Vite + TanStack Router)
- `services/email-worker` — Cloudflare Worker bundling API + admin UI (D1 + KV)
- `services/email-bridge` — CF Worker: receives bounce/complaint email and forwards to email-server webhook
- `Dockerfile.email-api` — production image for emailflare-api
- `compose.email-api.yaml` — single-container production compose
- `compose.email-api.dev.yaml` — local dev stack with hot reload

**Inbox**
- `services/inbox-server` — Hono inbox API: inboxes, people, threads, sequences, templates
- `services/inbox-ui` — React inbox dashboard (Vite + TanStack Router)
- `services/inbox-worker` — Cloudflare Worker variant of the inbox (D1)
- `services/inbox-bridge` — CF Worker: receives inbound email via CF Email Routing, forwards to inbox-server
- `Dockerfile.email-inbox` — production image for emailflare-inbox
- `compose.email-inbox.yaml` — single-container production compose
- `compose.email-inbox.dev.yaml` — local dev stack with hot reload

**Shared**
- `services/emails` — shared email layouts and rendering used by both servers
- `scripts/` — setup tooling for CF Worker deployments (`setup.mjs`, `config.example.toml`)
- `justfile` — task runner for dev, prod, and Cloudflare Worker operations ([RECIPES.md](./RECIPES.md))
- `docs/SELF_HOSTING.md` — Docker self-hosting guide
- `docs/CLOUDFLARE.md` — Cloudflare Workers deployment guide

---

## Self-hosting

Both services follow the same minimal self-host pattern:

- SQLite via embedded mesahub-core (no separate database)
- one Docker image per service
- one persistent volume at `/data`

Read the full guide: [docs/SELF_HOSTING.md](./docs/SELF_HOSTING.md)

---

## Minimum required environment

**emailflare-api** (`.env.local`):

| Variable | Description |
|---|---|
| `ADMIN_TOKEN` | Admin API token (32+ chars) |
| `SESSION_SECRET` | Session signing secret (32+ chars) |
| `MESAHUB_URL` | `mh://local/emailflare` for embedded SQLite |
| `CF_API_TOKEN` | Cloudflare token with Email Sending + Zone permissions |
| `CF_ACCOUNT_ID` | Cloudflare account ID |

**emailflare-inbox** (`.env.inbox.local`):

| Variable | Description |
|---|---|
| `SESSION_SECRET` | Session signing secret (32+ chars) |
| `WEBHOOK_SECRET` | Shared secret for inbox-bridge webhook auth |
| `MESAHUB_URL` | `mh://local/inbox-db` for embedded SQLite |
| `REDIS_URL` | Redis connection string (rate limiting + BullMQ) |
| `CF_API_TOKEN` | Cloudflare token for sending replies |
| `CF_ACCOUNT_ID` | Cloudflare account ID |

---

## Open source

- License: [MIT](./LICENSE)
- Contributing guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Security policy: [SECURITY.md](./SECURITY.md)
