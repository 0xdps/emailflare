# Developer Recipes

EmailFlare uses [`just`](https://github.com/casey/just) as the workspace command runner. Run `just` or `just --list` from the repository root to see all available tasks.

---

## Workspace Setup

### `just install`

Installs dependencies for all monorepo workspaces.

```bash
just install
cp apps/web/.dev.vars.example apps/web/.dev.vars
```

---

## Local Development

### `just web-dev`

Starts the unified Cloudflare Worker dev server with Miniflare local emulation for D1, KV, and R2.

- Web Dashboard: `http://localhost:5173` (or `http://localhost:3000`)
- Backend & Public API: `/api/*` and `/v1/*` on the same host

```bash
just web-dev
```

### `just web-migrate`

Applies all SQL migrations from `apps/web/migrations/` to the local D1 database. Required on first run before completing the `/setup` wizard.

```bash
just web-migrate
```

### `just web-build`

Runs typechecks and compiles the production Worker bundle (`apps/web/dist`).

```bash
just web-build
```

---

## Quality & Testing

### `just test`

Executes unit test suites across all core packages (`@emailflare/email-core` and `@emailflare/inbox-core`).

```bash
just test
```

### `just typecheck`

Runs strict TypeScript compilation checks across all monorepo packages.

```bash
just typecheck
```

---

## Production Deployment

### `just web-deploy`

Builds shared packages, applies pending migrations to the remote Cloudflare D1 database, and deploys the unified Worker bundle via Wrangler.

```bash
just web-deploy
```

### `just web-migrate-remote`

Applies pending D1 schema migrations directly to the remote production database without redeploying Worker code.

```bash
just web-migrate-remote
```

---

## Marketing Website

The marketing site (`apps/landing`) is built with Astro and deployed as an independent Worker:

```bash
just landing-dev    # Start local Astro dev server
just landing-build  # Build static/edge production assets
```
