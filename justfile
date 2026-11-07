# EmailFlare · task runner
#
# apps/web: Unified Cloudflare Worker (Next.js + Hono API + D1 Migrations + Emails)
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
    rm -rf apps/web/dist apps/landing/dist

# ── Unified Web App & Worker (apps/web) ──────────────────────────────────────

# Run the unified app locally with Miniflare bindings (Next.js + Hono API + emails)
web-dev:
    pnpm --filter @emailflare/web dev

# Production build of the unified Worker
web-build:
    pnpm --filter @emailflare/web build

# Preview production build locally via Miniflare/Wrangler
web-preview:
    pnpm --filter @emailflare/web preview

# Apply remote migrations and deploy unified Worker to Cloudflare
web-deploy:
    pnpm --filter @emailflare/web deploy

# Set or update a remote secret in the web Worker (e.g. just web-secret SESSION_SECRET)
web-secret key:
    cd apps/web && pnpm exec wrangler secret put {{key}}

# ── Database Migrations (apps/web/migrations) ────────────────────────────────

# Apply D1 migrations to the local database
web-migrate:
    pnpm --filter @emailflare/web migrations:apply:local

# Apply D1 migrations to the remote production database
web-migrate-remote:
    pnpm --filter @emailflare/web migrations:apply

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
