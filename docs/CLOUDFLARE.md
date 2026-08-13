# Cloudflare Workers Deployment

EmailFlare can be deployed as a Cloudflare Worker — no Docker, no servers. The Worker bundles the API and admin panel into a single edge deployment backed by D1 (SQLite) and KV.

## What gets deployed

| Resource | Purpose |
|---|---|
| **Worker** | Hono API + React admin SPA (static assets) |
| **D1 database** | Domains, templates, API keys, email logs |
| **KV namespace** | Rate limiting |
| **Worker Secrets** | Admin token, session secret, CF credentials |

## Requirements

- [Node.js](https://nodejs.org) 18+
- [pnpm](https://pnpm.io) 8+
- [just](https://github.com/casey/just) (task runner)
- A Cloudflare account

## 1. Install dependencies

```bash
just install
```

This installs `smol-toml` for the setup script, and all worker and admin dependencies.

## 2. Authenticate with Cloudflare

```bash
just emailflare-api-worker-login
```

Opens a browser to complete the OAuth flow. This is the only authentication step needed — no API token is required for deployment.

## 3. Configure

```bash
cp scripts/config.example.toml scripts/config.toml
```

Edit `scripts/config.toml`:

```toml
[deploy]
# D1 database name. "emailflare" is the default.
database_name = "emailflare"

[secrets]
# Admin dashboard password (32+ chars recommended)
admin_token = "change-me"

# JWT signing secret (32+ chars). Generate: openssl rand -hex 32
session_secret = "change-me"

# Runtime Cloudflare token for sending email.
# Permissions: Email Routing (Edit), Zone (Read), DNS (Edit)
cf_api_token = "your-runtime-token"

# Your Cloudflare account ID
cf_account_id = "your-account-id"

# Leave blank on first run — fill in after deploy with the worker URL.
# e.g. https://emailflare-api-worker.YOUR-ACCOUNT.workers.dev
admin_origin = ""
```

`scripts/config.toml` is gitignored — your secrets stay local.

## 4. Run setup

```bash
just emailflare-api-worker-setup
```

This single command:

1. Verifies Cloudflare authentication
2. Creates the D1 database (`emailflare`)
3. Creates the KV namespace (`emailflare-api-rate-limit`)
4. Patches `wrangler.jsonc` with the real resource IDs
5. Applies database migrations (schema + system email templates)
6. Sets all Worker secrets
7. Builds the admin panel
8. Deploys the Worker

The setup is idempotent — safe to re-run if anything fails.

## 5. Set ADMIN_ORIGIN (second run)

After the first deploy, the worker URL is printed in the output:

```
https://emailflare-api-worker.YOUR-ACCOUNT.workers.dev
```

Set `admin_origin` in `scripts/config.toml` to that URL, then re-run:

```bash
just emailflare-api-worker-setup
```

This updates the `ADMIN_ORIGIN` secret so the admin panel's CORS and auth checks work correctly.

## Deploying updates

```bash
just emailflare-api-worker-update
```

Applies any pending D1 migrations then redeploys the Worker atomically.

## Gradual rollout

To roll out a new version to a percentage of traffic:

```bash
# Upload a new version (applies migrations, does not shift traffic)
cd services/email-worker && pnpm run cf:rollout

# Send 10% of traffic to the new version
npx wrangler versions deploy --version-percentage <VERSION_ID>=10

# Full cutover when satisfied
npx wrangler versions deploy --version-percentage <VERSION_ID>=100
```

## Updating secrets

```bash
just emailflare-api-worker-secret SECRET_NAME
```

You'll be prompted to enter the new value (input is hidden). Available secret names: `ADMIN_TOKEN`, `SESSION_SECRET`, `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `ADMIN_ORIGIN`.

## Local development

```bash
just emailflare-api-worker-dev
```

Starts a local Worker dev server with a local D1 database and KV stubs. No secrets are required for local development.

## Localflare dashboard

```bash
just emailflare-api-worker-localflare
```

Starts Localflare against the Worker config in `services/email-worker/wrangler.jsonc` and opens the Localflare dashboard flow with shared local bindings.

The recipe defaults to port `8790` to avoid collisions with `wrangler dev` on `8787`.

Use a custom port when needed:

```bash
just emailflare-api-worker-localflare 8787
```

## Remove Worker resources

```bash
just emailflare-api-worker-remove
```

Deletes all Cloudflare resources defined in `services/email-worker/wrangler.jsonc`:

1. Worker (`name`)
2. D1 database (`d1_databases[0].database_name`)
3. KV namespace (`kv_namespaces[0].id`)

This command is destructive and intended for teardown/cleanup. It is safe to re-run; missing resources are skipped.

## API token permissions reference

| Token | Required permissions |
|---|---|
| Runtime token (`secrets.cf_api_token`) | Email Routing: Edit, Zone: Read, DNS: Edit |

Create tokens at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens).
