# @emailflare/web

Unified EmailFlare app. Next.js (App Router, via vinext) is the dashboard. The Worker entry in `worker/` also owns:

- `/health`, `/api/*`, `/v1/*` — Hono, mounted from `worker/inbox`
- `email()` — inbox delivery, plus bounce and complaint suppression
- `scheduled()` / `queue()` — sequence delivery
- `NotificationsHub` — per-user WebSocket Durable Object

```bash
pnpm --filter @emailflare/web dev
pnpm --filter @emailflare/web build
```

The dashboard pages in `app/` render the ported inbox UI. They call the same `/api` routes.

Local secrets go in `apps/web/.dev.vars` (see `.dev.vars.example`).

Apply the shared schema to the local D1 database before using `/api`:

```bash
pnpm --filter @emailflare/web migrations:apply:local
```
