<p align="center">
  <img src="./apps/web/public/favicon.svg" width="64" height="64" alt="EmailFlare logo" />
</p>

# EmailFlare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/0xdps/emailflare)

EmailFlare is a Cloudflare-native email platform: a sending API and a team inbox, deployed as **one new Cloudflare Worker**. The button provisions D1, KV, R2, and a queue, then deploys. Details: [docs/CLOUDFLARE.md](./docs/CLOUDFLARE.md).

The app lives in [`apps/web`](./apps/web). Next.js (via [vinext](https://github.com/cloudflare/vinext)) serves the dashboard. A Hono app on the same Worker serves `/api/*` and `/v1/*`, handles inbound email, the sequence cron, and the send queue.

Shared libraries stay in `packages/email-core`, `packages/inbox-core`, and `services/emails`. The marketing site (`services/landing`) is a separate Worker.

---

## Local development

```bash
just install
cp apps/web/.dev.vars.example apps/web/.dev.vars
just web-dev
```

In another terminal, apply the schema to the local D1 database:

```bash
just web-migrate
```

Open `http://localhost:3000`. The first visit should land on `/setup`.

## Deploy

Fill real resource IDs in [`apps/web/wrangler.jsonc`](./apps/web/wrangler.jsonc) (the checked-in file uses placeholders), set Worker secrets, then:

```bash
just web-deploy
just web-migrate-remote
```

Point Cloudflare Email Routing at the `emailflare` Worker. The Worker handles both outbound sending and inbound mail.

See [`apps/web/README.md`](./apps/web/README.md) for bindings, secrets, and routes.

## Layout

```text
apps/web              unified Worker (dashboard + API + email + cron + queue)
packages/email-core   sending, DNS, suppression helpers
packages/inbox-core   threading and sequence helpers
services/emails       shared email layouts
services/landing      marketing site (separate Worker)
migrations            D1 schema
```
