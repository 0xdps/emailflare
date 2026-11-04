# Recipes

One app: `apps/web`. Run `just --list` for the current set.

## Setup

### `just install`

Install workspace dependencies and build `services/emails`, `packages/email-core`, and `packages/inbox-core`.

```bash
just install
cp apps/web/.dev.vars.example apps/web/.dev.vars
```

### `just emails-build`

Rebuild the shared email layouts after editing `services/emails`.

```bash
just emails-build
```

## Local app

### `just web-dev`

Start the unified Worker locally. Dashboard on `http://localhost:3000`. API routes are `/api/*` and `/v1/*` on the same origin.

```bash
just web-dev
```

### `just web-migrate`

Apply `migrations/` to the local D1 database. Required before `/setup` or `/api/setup/status` can succeed.

```bash
just web-migrate
```

### `just web-build`

Build shared packages, then the production Worker bundle.

```bash
just web-build
```

## Deploy

Fill real resource IDs in `apps/web/wrangler.jsonc` first. See [CLOUDFLARE.md](./CLOUDFLARE.md).

### `just web-deploy`

Build and deploy the `emailflare` Worker.

```bash
just web-deploy
```

### `just web-migrate-remote`

Apply `migrations/` to the remote D1 database.

```bash
just web-migrate-remote
```

## Marketing site

```bash
just landing-dev
just landing-build
```
