<p align="center">
  <img src="./services/email-ui/public/favicon.svg" width="64" height="64" alt="EmailFlare logo" />
</p>

# EmailFlare

EmailFlare is a Cloudflare-native email platform with two independent services that work together:

- **emailflare-api** — transactional email sending API with an admin dashboard (domains, templates, API keys, logs, suppressions, lists + one-click unsubscribe)
- **emailflare-inbox** — team inbox and lightweight CRM (receive, thread, reply, sequences, multi-user, lists + one-click unsubscribe)

Both services are built on Cloudflare — Email Sending, Email Routing, D1, KV, R2, Queues, and Durable Objects — and deploy as **Cloudflare Workers** (primary, zero-ops) or as a single **Docker** container with embedded SQLite (secondary, for self-hosting).

---

## emailflare-api · Email Sending API

A Hono API for sending transactional email via the Cloudflare Email Sending API, with a React admin panel for managing domains, templates, API keys, and logs.

**Cloudflare Worker deployment** (primary — no Docker, edge-native)

```bash
just install
cp scripts/config.example.toml scripts/config.toml
# fill in your values
just emailflare-api-worker-setup
```

Read the full guide: [docs/CLOUDFLARE.md](./docs/CLOUDFLARE.md)

**Docker self-host** (secondary)

```text
gcr.io/0xdps/emailflare-api:latest
```

```bash
cp .env.api.example .env.local
# fill in SESSION_SECRET, ADMIN_TOKEN, CF_API_TOKEN, CF_ACCOUNT_ID

docker compose --env-file .env.local -f deploy/docker/compose.email-api.yaml up -d
```

Open `http://localhost:8090`. Read the full guide: [docs/SELF_HOSTING.md](./docs/SELF_HOSTING.md)

**Railway**

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/emailflare)

---

## emailflare-inbox · Team Inbox & CRM

A Node.js inbox server with a React dashboard for receiving inbound email via Cloudflare Email Routing, threading conversations, replying, running sequences, and managing contacts across a team.

**Cloudflare Worker deployment** (primary — inbox-worker, D1 + R2 + KV + DO + Queues)

```bash
just install
cp scripts/config.example.toml scripts/config.toml
# fill in your values
just emailflare-inbox-deploy
```

Read the full guide: [docs/CLOUDFLARE.md](./docs/CLOUDFLARE.md)

**Docker self-host** (secondary)

```text
ghcr.io/0xdps/emailflare-inbox:latest
```

```bash
cp .env.inbox.example .env.inbox.local
# fill in SESSION_SECRET, WEBHOOK_SECRET, CF_API_TOKEN, CF_ACCOUNT_ID, REDIS_URL

docker compose --env-file .env.inbox.local -f deploy/docker/compose.email-inbox.yaml up -d
```

Open `http://localhost:8091`. Read the full guide: [docs/SELF_HOSTING.md](./docs/SELF_HOSTING.md)

---

## What ships in this repo

**Email API**

- `services/email-worker` — Cloudflare Worker bundling API + admin UI (D1 + KV) — **primary deploy**
- `services/email-server` — Hono API (Node.js): domains, templates, keys, stats, send — for Docker
- `services/email-ui` — React admin panel (Vite + TanStack Router)
- `services/email-bridge` — CF Worker: receives bounce/complaint email and forwards to email-server webhook
- `deploy/docker/Dockerfile.email-api` — production image for emailflare-api
- `deploy/docker/compose.email-api.yaml` — single-container production compose
- `deploy/docker/compose.email-api.dev.yaml` — local dev stack with hot reload

**Inbox**

- `services/inbox-worker` — Cloudflare Worker variant of the inbox (D1 + R2 + KV + DO + Queues) — **primary deploy**
- `services/inbox-server` — Hono inbox API (Node.js): inboxes, people, threads, sequences, templates — for Docker
- `services/inbox-ui` — React inbox dashboard (Vite + TanStack Router)
- `services/inbox-bridge` — CF Worker: receives inbound email via CF Email Routing, forwards to inbox-server
- `deploy/docker/Dockerfile.email-inbox` — production image for emailflare-inbox
- `deploy/docker/compose.email-inbox.yaml` — single-container production compose
- `deploy/docker/compose.email-inbox.dev.yaml` — local dev stack with hot reload

**Shared**

- `services/emails` — shared email layouts and rendering used by both servers
- `scripts/` — setup tooling for CF Worker deployments (`setup.mjs`, `config.example.toml`)
- `justfile` — task runner for dev, prod, and Cloudflare Worker operations ([docs/RECIPES.md](./docs/RECIPES.md))
- `docs/CLOUDFLARE.md` — Cloudflare Workers deployment guide (**primary**)
- `docs/SELF_HOSTING.md` — Docker self-hosting guide (**secondary**)

---

## Deployment modes

EmailFlare supports two deployment modes for each product:

| Mode                             | Products                         | Stack                                | When to use                     |
| -------------------------------- | -------------------------------- | ------------------------------------ | ------------------------------- |
| **Cloudflare Workers** (primary) | emailflare-api, emailflare-inbox | D1 + KV (+ R2, Queues, DO for inbox) | Default — zero-ops, edge-native |
| **Docker** (secondary)           | emailflare-api, emailflare-inbox | single container + embedded SQLite   | Self-hosting on your own VPS/VM |

The Docker path uses SQLite via embedded mesahub-core (one image, one volume at `/data`).

Read the full guides: [docs/CLOUDFLARE.md](./docs/CLOUDFLARE.md) · [docs/SELF_HOSTING.md](./docs/SELF_HOSTING.md)

---

## Minimum required environment

**emailflare-api** (`.env.local`):

| Variable         | Description                                                      |
| ---------------- | ---------------------------------------------------------------- |
| `ADMIN_TOKEN`    | Admin API token (32+ chars)                                      |
| `SESSION_SECRET` | Session signing secret (32+ chars)                               |
| `MESAHUB_URL`    | `mh://local/emailflare` for embedded SQLite                      |
| `CF_API_TOKEN`   | Cloudflare token with Email Sending + Zone permissions           |
| `CF_ACCOUNT_ID`  | Cloudflare account ID                                            |
| `PUBLIC_URL`     | Public base URL, used for one-click unsubscribe links (optional) |

**emailflare-inbox** (`.env.inbox.local`):

| Variable         | Description                                                                   |
| ---------------- | ----------------------------------------------------------------------------- |
| `SESSION_SECRET` | Session signing secret (32+ chars)                                            |
| `WEBHOOK_SECRET` | Shared secret for inbox-bridge webhook auth                                   |
| `MESAHUB_URL`    | `mh://local/inbox-db` for embedded SQLite                                     |
| `REDIS_URL`      | Redis connection string (rate limiting + BullMQ)                              |
| `CF_API_TOKEN`   | Cloudflare token for sending replies                                          |
| `CF_ACCOUNT_ID`  | Cloudflare account ID                                                         |
| `PUBLIC_URL`     | Public base URL, used for one-click unsubscribe links in sequences (optional) |

---

## Open source

- License: [MIT](./LICENSE)
- Contributing guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Security policy: [SECURITY.md](./SECURITY.md)
