---
title: Introduction
description: What EmailFlare is, what runs where, and which page to read first.
section: Start
order: 10
---

EmailFlare is an email API and a shared team inbox that you deploy into your own Cloudflare account. One Worker serves the dashboard, the HTTP API, inbound mail handling and background jobs. Your messages, contacts, logs and keys live in your own D1 database and R2 bucket.

## What you get

- **A send API.** `POST /v1/send` with a scoped API key. Send raw HTML or text, or reference a template by slug and pass variables.
- **A shared inbox.** Mail to `support@`, `sales@` or any address you add arrives as a thread. Your team replies from the address the customer wrote to.
- **Deliverability basics.** Bounces and complaints are recorded as suppressions, list sends carry one-click unsubscribe headers, and every send is logged with its Cloudflare message ID.
- **Templates.** Fifty built-in layouts, plus your own HTML templates with variables. Browse the layouts in the [template gallery](/templates).
- **A workspace for the team.** Roles, two-factor sign-in, webhooks and an audit log.

## What runs where

| Piece                        | Cloudflare product | What it does                                                                     |
| ---------------------------- | ------------------ | -------------------------------------------------------------------------------- |
| Dashboard and API            | Workers            | One Worker serves `/inbox`, `/developer/*`, `/settings/*`, `/api/*` and `/v1/*`. |
| Data                         | D1                 | Users, mailboxes, threads, contacts, templates, keys, logs, suppressions.        |
| Large bodies and attachments | R2                 | Inbound message bodies over 512 KB and attachments.                              |
| Outbound delivery            | Email Sending      | Every live send goes through your account's Email Sending.                       |
| Inbound mail                 | Email Routing      | A catch-all rule hands incoming mail to the Worker.                              |
| Live updates                 | Durable Objects    | Pushes new mail to open inbox tabs.                                              |
| Scheduled work               | Queues and cron    | Scheduled sends and sequence steps.                                              |

The dashboard is a React app built with vinext and served by the same Worker as the API.

## Where to start

1. [Quickstart](/docs/quickstart) takes you from a fresh deploy to a captured test email.
2. [Authentication and API keys](/docs/authentication) explains key types and scopes.
3. [Send an email](/docs/send-an-email) is the full request reference.
4. [Domains and DNS](/docs/domains-and-dns) covers moving from test mode to real delivery.

To deploy, see [Deploy to Cloudflare](/cloudflare). EmailFlare is free to use and self-host under the [Elastic License 2.0](/license), and the source is on [GitHub](https://github.com/0xdps/emailflare).
