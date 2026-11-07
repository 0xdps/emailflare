# EmailFlare · task runner
#
# apps/dashboard: Unified Cloudflare Worker (Next.js + Hono API + D1 Migrations + Emails)
# apps/landing: Public marketing website (Astro on Cloudflare Workers)

# List all recipes
default:
    @just --list

# ── Setup & Workspace ────────────────────────────────────────────────────────

# Install workspace dependencies
install:
    pnpm install

# Clean build artifacts across all workspaces
clean:
    rm -rf apps/dashboard/dist apps/landing/dist

# ── Unified Dashboard App & Worker (apps/dashboard) ──────────────────────────

# Run dashboard locally with Miniflare bindings (Next.js + Hono API + emails)
dashboard-dev:
    pnpm --filter @emailflare/dashboard dev

alias dev := dashboard-dev

# Production build of the unified Worker
dashboard-build:
    pnpm --filter @emailflare/dashboard build

alias build := dashboard-build

# Preview production build locally via Miniflare/Wrangler
dashboard-preview:
    pnpm --filter @emailflare/dashboard preview

# Apply remote migrations and deploy unified Worker to Cloudflare
dashboard-deploy:
    pnpm --filter @emailflare/dashboard deploy

alias deploy := dashboard-deploy

# Set or update a remote secret in the dashboard Worker (e.g. just dashboard-secret SESSION_SECRET)
dashboard-secret key:
    cd apps/dashboard && pnpm exec wrangler secret put {{key}}

# ── Database Migrations (apps/dashboard/migrations) ─────────────────────────

# Apply D1 migrations to the local database
dashboard-migrate:
    pnpm --filter @emailflare/dashboard migrations:apply:local

alias migrate := dashboard-migrate

# Apply D1 migrations to the remote production database
dashboard-migrate-remote:
    pnpm --filter @emailflare/dashboard migrations:apply

# ── Quality, Testing & Formatting ────────────────────────────────────────────

# Run unit tests
test:
    pnpm test

# Type-check all packages
typecheck:
    pnpm typecheck

# Format code with Prettier
format:
    pnpm format

# Verify formatting without writing
format-check:
    pnpm format:check

# Audit dependencies for high/critical vulnerabilities
audit:
    pnpm audit

# ── Marketing Website (apps/landing) ─────────────────────────────────────────

# Run marketing site dev server locally
landing-dev:
    pnpm --filter emailflare-landing dev

# Build marketing site production assets
landing-build:
    pnpm --filter emailflare-landing build

# Preview marketing site production build locally
landing-preview:
    pnpm --filter emailflare-landing preview

# Deploy marketing site to Cloudflare
landing-deploy:
    pnpm --filter emailflare-landing deploy
