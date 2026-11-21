---
title: Self-hosting and updating
description: What a deployment contains, which settings it needs, how to run it locally, and how to update it.
section: Operate
order: 130
---

EmailFlare runs entirely in your Cloudflare account. This page is the short version. The [Deploy to Cloudflare](/cloudflare) guide has the full walkthrough, and [Create an API token](/cloudflare-token) lists the token permissions.

## What a deployment contains

| Resource       | Binding         | Purpose                                                                   |
| -------------- | --------------- | ------------------------------------------------------------------------- |
| Worker         |                 | Dashboard, `/api/*`, `/v1/*`, inbound mail, cron and queue handlers.      |
| D1 database    | `DB`            | Users, mailboxes, threads, contacts, templates, keys, logs, suppressions. |
| R2 bucket      | `ATTACHMENTS`   | Large inbound bodies and attachments.                                     |
| KV namespace   | `RATE_LIMIT_KV` | Sign-in rate limiting.                                                    |
| Queue          | `EMAIL_QUEUE`   | Sequence steps and scheduled sends.                                       |
| Durable Object | `NOTIFICATIONS` | Live inbox updates over WebSocket.                                        |
| Rate limiter   | `RATE_LIMITER`  | The 100 requests per minute limit on each API key.                        |

## Settings

Secrets, set with `just dashboard-secret <NAME>`:

| Name             | Purpose                                                           |
| ---------------- | ----------------------------------------------------------------- |
| `SESSION_SECRET` | Signs session cookies. Use at least 32 random characters.         |
| `CF_API_TOKEN`   | Cloudflare token for zones, DNS, Email Sending and Email Routing. |
| `CF_ACCOUNT_ID`  | The account that owns the token.                                  |

Variables, set in `wrangler.production.jsonc`:

| Name                | Purpose                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_URL`        | Public origin, for example `https://mail.yourcompany.com`. Invite, password reset, unsubscribe and tracking links use it. |
| `INBOX_WORKER_NAME` | Worker that receives catch-all mail. Keep it equal to the Worker's `name`.                                                |
| `CF_DAILY_LIMIT`    | Daily send ceiling shown on the overview. Defaults to `1000`.                                                             |

`PUBLIC_URL` matters more than it looks. Without it, `listId` adds no unsubscribe headers, and tracking and invite links fall back to the request's origin.

## Run it locally

You need Node.js 22 or later, pnpm 11 or later and, optionally, [`just`](https://github.com/casey/just).

```bash
git clone https://github.com/0xdps/emailflare.git
cd emailflare
just install
cp apps/dashboard/.dev.vars.example apps/dashboard/.dev.vars
just dashboard-migrate
just dashboard-dev
```

Open `http://localhost:5173`. The first visit goes to `/setup`. Local runs use emulated D1, KV, R2 and Durable Objects, so nothing touches your Cloudflare account until you add a real token. Test keys work with no token at all.

Other commands: `just test` runs the unit tests, `just typecheck` checks types, and `just dashboard-preview` runs the production build locally.

## Update

1. Read the [changelog](https://github.com/0xdps/emailflare/blob/trunk/CHANGELOG.md) for the versions you are skipping.
2. Pull the latest `trunk` from the upstream repository into your copy.
3. Deploy.
    - With Workers Builds, pushing to your production branch deploys. The deploy command is `pnpm run deploy`.
    - From a terminal, run `just dashboard-deploy`.

The deploy applies pending D1 migrations to your remote database before it ships the new Worker, so you do not run migrations separately. To apply migrations without deploying, use `just dashboard-migrate-remote`.

Migrations are not rolled back with the Worker. If you roll the Worker back to an earlier version, the database keeps the newer schema, so check the changelog before you do.

## Costs

EmailFlare adds no per-seat or per-email fee. You pay Cloudflare for what you use, for example Workers requests, D1 reads and writes, R2 storage and Email Sending. Check Cloudflare's pricing for current limits and rates.

## Logs

Stream live logs from the Worker:

```bash
cd apps/dashboard
pnpm exec wrangler tail
```

You can also read them under **Logs** for the Worker in the Cloudflare dashboard.
