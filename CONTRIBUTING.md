# Contributing

## Development setup

```bash
just install
cp apps/web/.dev.vars.example apps/web/.dev.vars
just web-dev
just web-migrate
```

The app runs locally on Miniflare. You do not need Docker, Redis, or a second process.

## Before opening a pull request

- keep changes focused
- update docs when behavior or setup changes
- build the affected package before submitting
- include screenshots for visible UI changes

Useful commands:

```bash
just web-dev
just web-build
just landing-build
pnpm run typecheck
```

## Scope

Good contributions include:

- dashboard and API quality
- email template and deliverability improvements
- docs and examples

Open an issue or draft PR first for larger changes that affect architecture or deployment.
