# EmailFlare · task runner
#
# One app: apps/web (Next.js via vinext + the Hono API on a single Worker).
# Shared packages: packages/email-core, packages/inbox-core, services/emails.
# Marketing site: services/landing (separate Worker).

# List all recipes
default:
    @just --list

# Install workspace dependencies and build shared packages
install:
    pnpm install
    pnpm --filter @emailflare/emails run build
    pnpm --filter @emailflare/email-core run build
    pnpm --filter @emailflare/inbox-core run build

# Rebuild the shared email layouts
emails-build:
    pnpm --filter @emailflare/emails run build

# Run the unified app locally (Miniflare bindings)
web-dev:
    pnpm --filter @emailflare/web dev

# Production build of the unified Worker
web-build:
    pnpm run build:shared
    pnpm --filter @emailflare/web build

# Apply D1 migrations to the local database
web-migrate:
    pnpm --filter @emailflare/web migrations:apply:local

# Apply D1 migrations to the remote database
web-migrate-remote:
    pnpm --filter @emailflare/web migrations:apply

# Build shared packages, apply remote migrations, and deploy
web-deploy:
    pnpm --filter @emailflare/web deploy

# Build shared packages, apply remote migrations, and deploy
web-deploy:
    pnpm --filter @emailflare/web deploy

# Marketing site
landing-dev:
    pnpm --filter emailflare-landing dev

landing-build:
    pnpm --filter emailflare-landing build
