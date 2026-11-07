# Developer Recipes

EmailFlare uses [`just`](https://github.com/casey/just) as the workspace command runner. Run `just` or `just --list` from the repository root to see all available tasks.

---

## Workspace Setup

### `just install`

Installs dependencies for all monorepo workspaces (`apps/dashboard` and `apps/landing`).

```bash
just install
cp apps/dashboard/.dev.vars.example apps/dashboard/.dev.vars
```

### `just clean`

Removes build artifacts and temporary compilation directories across all workspaces (`apps/dashboard/dist` and `apps/landing/dist`).

```bash
just clean
```

---

## Unified Dashboard App & Worker (`apps/dashboard`)

### `just dashboard-dev` _(alias: `just dev`)_

Starts the unified Cloudflare Worker development server with Miniflare local emulation for D1, KV, Durable Objects, and R2.

- **Web Dashboard:** `http://localhost:5173`
- **REST & Sending APIs:** `/api/*` and `/v1/*` served by the same Worker
- **Email Sandboxing:** Inbound email previews and live updates

```bash
just dashboard-dev
# or simply:
just dev
```

### `just dashboard-build` _(alias: `just build`)_

Compiles the Next.js App Router and Worker bundle with Vite and vinext (`apps/dashboard/dist`).

```bash
just dashboard-build
# or simply:
just build
```

### `just dashboard-preview`

Builds and starts a local Miniflare preview environment that runs the compiled production bundle directly through Wrangler.

```bash
just dashboard-preview
```

### `just dashboard-deploy` _(alias: `just deploy`)_

Builds the application, applies any pending D1 schema migrations to the remote database, and deploys the unified Worker bundle to Cloudflare.

```bash
just dashboard-deploy
# or simply:
just deploy
```

### `just dashboard-secret <KEY>`

Interactively sets or updates an encrypted environment secret on the live Cloudflare Worker without storing it in configuration files.

```bash
just dashboard-secret SESSION_SECRET
just dashboard-secret CF_API_TOKEN
```

---

## Database Migrations (`apps/dashboard/migrations`)

### `just dashboard-migrate` _(alias: `just migrate`)_

Applies all local SQL migrations from `apps/dashboard/migrations/` to your local Miniflare D1 database. Required on first setup before accessing the dashboard.

```bash
just dashboard-migrate
# or simply:
just migrate
```

### `just dashboard-migrate-remote`

Applies pending D1 schema migrations directly to the live remote Cloudflare D1 database without triggering a full worker redeploy.

```bash
just dashboard-migrate-remote
```

---

## Quality, Testing & Formatting

### `just test`

Runs the Node.js test runner across all unit test suites (`apps/dashboard/test/*.test.ts`) covering bounce parsing, delivery queues, password verification, address parsing, and templates.

```bash
just test
```

### `just typecheck`

Executes strict TypeScript type-checking (`tsc --noEmit`) across the codebase.

```bash
just typecheck
```

### `just format`

Formats code across all files using Prettier.

```bash
just format
```

### `just format-check`

Verifies that all files conform to Prettier formatting rules without modifying them (used in CI).

```bash
just format-check
```

### `just audit`

Audits dependencies for high and critical security vulnerabilities across the workspace.

```bash
just audit
```

---

## Marketing Website (`apps/landing`)

The public marketing and documentation site (`apps/landing`) is built with Astro and deployed as an independent Worker:

```bash
just landing-dev      # Start local Astro dev server (http://localhost:4321)
just landing-build    # Build static/edge production assets
just landing-preview  # Preview production build locally
just landing-deploy   # Deploy marketing site to Cloudflare Workers
```
