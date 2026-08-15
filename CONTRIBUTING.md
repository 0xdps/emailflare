# Contributing

## Development setup

```bash
cp .env.api.example .env.api.local
just emailflare-api-dev
```

The default local stack uses Docker and embedded mesahub so contributors do not need to provision extra infrastructure.

> **Production deployment:** Cloudflare Workers is the primary path; Docker is secondary.
> See [docs/CLOUDFLARE.md](./docs/CLOUDFLARE.md) and [docs/SELF_HOSTING.md](./docs/SELF_HOSTING.md).

## Before opening a pull request

- keep changes focused
- update docs when behavior or setup changes
- build the affected app before submitting
- include screenshots for visible UI changes

Useful commands:

```bash
just emailflare-api-dev
just emailflare-api-dev-down
cd services/email-ui && pnpm build
cd services/email-server && pnpm build
cd services/landing && pnpm build
```

## Scope

Good contributions include:

- deployment and self-hosting improvements
- admin UX improvements
- email template and API quality improvements
- docs and examples

Open an issue or draft PR first for larger changes that affect architecture or deployment flows.