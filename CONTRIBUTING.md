# Contributing to EmailFlare

Thank you for your interest in contributing to EmailFlare! EmailFlare is an open-source, edge-native email engine and collaborative team inbox built for Cloudflare.

---

## Local Development Setup

### Prerequisites

- **Node.js**: v22+
- **pnpm**: v11+
- **just**: Command runner (`brew install just` or `cargo install just`)

### Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/0xdps/emailflare.git
cd emailflare

# 2. Install dependencies
just install

# 3. Setup local secrets
cp apps/dashboard/.dev.vars.example apps/dashboard/.dev.vars

# 4. Apply migrations to the local D1 database
just dashboard-migrate

# 5. Start the local development server
just dashboard-dev
```

The application runs locally on Miniflare bindings. **You do not need Docker, Redis, or a local mail server.**

---

## Monorepo Layout

- `apps/dashboard`: The unified Cloudflare Worker bundle containing the Next.js frontend, Hono REST backend, D1 database migrations, queue consumers, email handlers, React Email templates, and core logic.
- `apps/landing`: The public marketing website (`emailflare.dev`) built with Astro.

---

## Code Quality & Pre-PR Checklist

Before opening a pull request, ensure all verification steps pass locally:

```bash
# Run unit test suites
just test

# Strict TypeScript typechecking across all packages
just typecheck

# Code formatting (Prettier)
just format

# Dependency security audit
just audit
```

Lefthook pre-commit hooks run automatically on staged files to check secrets, format with Prettier, and verify TypeScript types.

---

## Pull Request Guidelines

1. **Keep Changes Focused:** Target one feature, improvement, or bug fix per PR.
2. **Preserve Documentation:** If introducing new capabilities, routes, or config parameters, update the relevant documentation in `docs/` and `README.md`.
3. **UI Contributions:** If making visual modifications to the dashboard or inbox, include before/after screenshots or short screen captures in your PR description.
4. **License:** All contributions are licensed under the [MIT License](./LICENSE).
