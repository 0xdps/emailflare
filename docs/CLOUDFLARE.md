# Cloudflare Workers Deployment

EmailFlare deploys as one new Cloudflare Worker: the dashboard, the sending API, inbound mail, the sequence cron, and the send queue. Do not reuse the old `emailflare-api` or `emailflare-inbox` Workers.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/0xdps/emailflare)

The button clones this repo into your Git account, creates a fresh D1 database, KV namespace, R2 bucket, and queue, then builds and deploys. The Worker name in the dashboard must stay `emailflare`, matching [apps/web/wrangler.jsonc](../apps/web/wrangler.jsonc).

Workers Builds settings, if they are not filled in automatically:

| Setting           | Value                                                        |
| ----------------- | ------------------------------------------------------------ |
| Root directory    | `apps/web`                                                   |
| Build command     | leave empty (`predeploy` builds shared packages and the app) |
| Deploy command    | `pnpm run deploy`                                            |
| Production branch | `staging` until `main` contains this app                     |

`pnpm run deploy` applies `migrations/` to the `DB` binding, then deploys. It uses the binding name, not the database name, so a renamed database still migrates.

After the first deploy:

1. Open the `workers.dev` URL and finish `/setup`.
2. Set `PUBLIC_URL` to that URL (or your custom domain) if it is not `https://emailflare.workers.dev`.
3. In the zone, point Email Routing at the `emailflare` Worker.
4. `CF_API_TOKEN` needs Email Sending and Email Routing edit. `CF_ACCOUNT_ID` is the account that owns this Worker.

Pushing to the production branch redeploys. Preview builds are off by default because this Worker uses a Durable Object.

## What gets deployed

| Resource                | Purpose                                                                           |
| ----------------------- | --------------------------------------------------------------------------------- |
| **Worker** (`apps/web`) | Next.js dashboard + Hono API + email / scheduled / queue handlers                 |
| **D1**                  | Domains, templates, API keys, logs, inbox, sequences                              |
| **KV**                  | Rate limiting and short-lived state                                               |
| **R2**                  | Raw inbound message bodies                                                        |
| **Queue**               | Outbound send jobs                                                                |
| **Durable Object**      | Live inbox notifications                                                          |
| **Secrets**             | Session secret and the Cloudflare API token used to configure sending and routing |

The marketing site (`services/landing`) is a separate Worker and is not part of this deploy.

## Requirements

- Node.js 22+
- pnpm 11+
- A Cloudflare account

## 1. Install

```bash
just install
```

## 2. Authenticate

```bash
cd apps/web && pnpm exec wrangler login
```

## 3. Deploy a new stack

Leave the placeholder IDs in [`apps/web/wrangler.jsonc`](../apps/web/wrangler.jsonc). Wrangler provisions a new D1 database, KV namespace, R2 bucket, and queue on first deploy, then the deploy script applies `migrations/` to the `DB` binding.

```bash
cd apps/web
pnpm exec wrangler secret put SESSION_SECRET
pnpm exec wrangler secret put CF_API_TOKEN
pnpm exec wrangler secret put CF_ACCOUNT_ID
just web-deploy
```

Do not point this config at the old database. This is a new deployment.

Local development reads the same secret names from `apps/web/.dev.vars` (see `.dev.vars.example`). Do not commit that file.

## 4. Email Routing

In the Cloudflare dashboard, point the zone's Email Routing catch-all (or the addresses you receive on) at the `emailflare` Worker. The same Worker sends mail through the Email Sending binding.

## CI

Prefer the Deploy to Cloudflare button. It connects the repo to Workers Builds, so later pushes deploy themselves.

`.github/workflows/deploy-workers.yml` is only a manual fallback. It needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets, then runs `pnpm run deploy` in `apps/web`.
