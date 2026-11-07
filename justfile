# EmailFlare · task runner
#
# apps/web: Unified Cloudflare Worker (Next.js + Hono API + templates + core logic)
# apps/landing: Marketing site (separate Worker)

# List all recipes
default:
    @just --list

# Install workspace dependencies
install:
    pnpm install

# Run the unified app locally (Miniflare bindings)
web-dev:
    pnpm --filter @emailflare/web dev

# Production build of the unified Worker
web-build:
    pnpm --filter @emailflare/web build

# Apply D1 migrations to the local database
web-migrate:
    pnpm --filter @emailflare/web migrations:apply:local

# Apply D1 migrations to the remote database
web-migrate-remote:
    pnpm --filter @emailflare/web migrations:apply

# Apply remote migrations and deploy
web-deploy:
    pnpm --filter @emailflare/web deploy

# Run test suite
test:
    pnpm test

# Type-check all packages
typecheck:
    pnpm typecheck

# Marketing site
landing-dev:
    pnpm --filter emailflare-landing dev

landing-build:
    pnpm --filter emailflare-landing build
