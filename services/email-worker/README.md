# emailflare-api-worker

Cloudflare-native parallel deployment of the emailflare backend.

| Layer               | Node.js backend                     | This worker                            |
| ------------------- | ----------------------------------- | -------------------------------------- |
| Runtime             | Node.js + `@hono/node-server`       | Cloudflare Workers                     |
| Database            | MesaHub (remote SQLite)             | **Cloudflare D1** (SQLite at the edge) |
| Sessions            | `iron-session` (Node.js crypto)     | `jose` SignJWT (Web Crypto)            |
| API rate limiting   | In-memory sliding window            | **Workers Rate Limiting** binding      |
| Login rate limiting | In-memory                           | **Workers KV**                         |
| Email sending       | CF REST API + in-house test mailbox | CF REST API + in-house test mailbox    |
| Secrets             | `.env` file / Docker env vars       | `wrangler secret put`                  |

Both deployments share the same API surface (`/v1/send`, `/api/*`) and the same admin UI.

---

## Quick Start

### 1. Create Cloudflare resources

```bash
# D1 database
wrangler d1 create emailflare
# → copy the database_id into wrangler.jsonc

# KV namespace for login rate limiting
wrangler kv namespace create RATE_LIMIT_KV
# → copy the id into wrangler.jsonc
```

> `wrangler.jsonc` is gitignored and generated from the tracked `wrangler.example.jsonc`
> template. Prefer `just emailflare-api-worker-setup` (scripts/setup.mjs), which creates the
> resources and generates the config automatically.

### 2. Apply the schema migration

```bash
# Local dev
pnpm migrations:apply:local

# Production
pnpm migrations:apply
```

### 3. Set secrets

```bash
wrangler secret put ADMIN_TOKEN        # min 32 chars — your admin password
wrangler secret put SESSION_SECRET     # min 32 chars — random string
wrangler secret put CF_API_TOKEN       # CF API token (Email Send + Zone + DNS perms)
wrangler secret put CF_ACCOUNT_ID      # your Cloudflare account ID
wrangler secret put ADMIN_ORIGIN       # e.g. "admin.example.com"
```

### 4. Deploy

```bash
pnpm deploy
```

### 5. Seed system templates (once)

After first deploy, hit the seed endpoint once with your admin token:

```bash
curl -X POST https://your-worker.workers.dev/api/_seed \
  -H "Cookie: ef_session=<your session cookie>"
```

Or log in to the admin UI and use the Playground → it will prompt to seed if templates are missing.

---

## Local Development

```bash
pnpm install
pnpm migrations:apply:local   # init local D1
pnpm dev                       # wrangler dev on http://localhost:8787
```

The email UI (`services/email-ui`) can be pointed at `http://localhost:8787` for local testing.

---

## Architecture Notes

### Why no test mailbox in the Worker?

Test API keys on the Node.js backend (`services/email-server`) capture email content into an in-house
Test Mailbox instead of sending. The Worker sends all emails (both `test` and `live` API keys) through
the Cloudflare Email Sending REST API. The `is_test` flag is still recorded in `email_logs` for audit purposes.

If you need test-mailbox capture locally, use the Node.js backend (`services/email-server`) instead.

### Rate Limiting

API key rate limiting uses the **Workers Rate Limiting** binding (100 req / 60s per key).
This requires the Workers Paid plan. To disable, remove the `unsafe.bindings` block from
`wrangler.example.jsonc` (and regenerate `wrangler.jsonc`) — the middleware will fall back to allowing all requests.

Login rate limiting uses Workers KV (10 attempts / 60s per IP). This works on all plans.

### Email rendering

`@react-email/render` runs in Workers via the `nodejs_compat` compatibility flag, which
polyfills Node.js built-ins (including `AsyncLocalStorage` for theme context). All email
layout components from `services/email-server/src/emails/layouts/` are bundled at build time.
