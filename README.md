<p align="center">
  <a href="https://emailflare.dev">
    <img src="./apps/web/public/favicon.svg" width="72" height="72" alt="EmailFlare logo" />
  </a>
</p>

<h1 align="center">EmailFlare</h1>

<p align="center">
  <strong>The open-source, edge-native email API and shared team inbox for Cloudflare.</strong><br />
  A modern transactional email engine and collaborative customer inbox — deployed to your Cloudflare account in one click.
</p>

<p align="center">
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/0xdps/emailflare">
    <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare" />
  </a>
  <a href="https://github.com/0xdps/emailflare/blob/trunk/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" />
  </a>
  <a href="https://emailflare.dev">
    <img src="https://img.shields.io/badge/website-emailflare.dev-orange.svg" alt="Website" />
  </a>
</p>

---

## What is EmailFlare?

**EmailFlare is a complete, self-hosted email platform built natively on Cloudflare.** It combines two products that modern software teams need into a single unified deployment:

1. **Transactional Email API** — A fast REST API (like Resend or Postmark) to send transactional emails from your applications, complete with scoped API keys, 50+ responsive React Email templates, bounce handling, and delivery logs.
2. **Collaborative Team Inbox** — A shared inbox (like Front or HelpScout) for addresses like `support@`, `sales@`, and `billing@`, featuring threaded conversations, multi-mailbox routing, contact history, and live updates.

Instead of managing bulky mail servers or paying \$100s/month to separate SaaS vendors for sending and support, EmailFlare runs entirely on **Cloudflare Workers, D1, R2, KV, and Queues** with zero server maintenance and near-zero infrastructure costs.

---

## Why EmailFlare?

### The Problem

- **Expensive SaaS Sprawl:** Teams pay \$20–\$100+/mo for transactional email APIs with strict per-email tiers, plus another \$15–\$30/user/mo for shared team inboxes like Google Workspace or Front.
- **Fragmented Context:** Your application's outbound transactional emails live in one provider, while customer replies get lost in another inbox, making it impossible to see a customer's complete history.
- **Self-Hosting Nightmare:** Traditional self-hosted mail stacks (Postfix, Dovecot, Docker containers) are fragile, require complex IP warmups, need constant spam monitoring, and require regular security patches.
- **Raw Cloudflare Primitives Lack an App Layer:** Cloudflare offers Email Routing (inbound) and Email Sending (outbound), but they are bare low-level building blocks. There is no web UI, no REST API keys, no template library, no deliverability analytics, and no team collaboration tooling.

### The Solution

EmailFlare is the **application layer for Cloudflare Email**. It transforms raw edge infrastructure into a polished, production-ready email engine:

- **100% Serverless & Edge-Native:** Runs globally in 300+ edge locations with sub-millisecond cold starts.
- **Own Your Data:** All emails, logs, and customer contacts remain in your own Cloudflare account.
- **One-Click Deploy:** One single Cloudflare Worker bundle deploys the Next.js web dashboard, the Hono REST API, the email routing engine, the background cron, and the send queue.

---

## Core Features

### 1. Developer Sending API & Deliverability Engine

- **Modern REST API:** Fast `/v1/send` endpoint for transactional emails from curl, Node.js, Python, Go, or any HTTP client.
- **Interactive Playground:** Test sends, preview live templates, and experiment with variable interpolation in a sandboxed developer environment.
- **50+ React Email Templates:** Pre-built, responsive email designs covering user onboarding, authentication (magic links, OTPs), billing & receipts, security alerts, and newsletters.
- **Scoped API Keys:** Issue keys restricted to specific domains or grant full workspace sending access.
- **Deliverability Protection:** Automatic bounce classification (hard vs. soft bounces), spam complaint ingestion, suppression lists, and RFC 8058 one-click list unsubscribe headers.
- **Activity & Delivery Logs:** Real-time searchable logs displaying Cloudflare message IDs, SMTP handoff statuses, error traces, and raw JSON events.

### 2. Collaborative Shared Team Inbox

- **Multi-Mailbox Routing:** Create distinct mailboxes for `support@yourdomain.com`, `billing@`, `sales@`, and assign specific team members.
- **Real-Time Threading:** Inbound emails automatically group into clean conversation threads with live WebSocket notifications.
- **In-App Compose & Reply:** Send responses directly from authorized domain addresses.
- **Secure HTML Sandboxing:** Inbound HTML emails are safely isolated in an unprivileged sandbox iframe with remote tracking pixels blocked until approved.
- **Automated Sequences:** Trigger drip campaigns and scheduled multi-step onboarding sequences.
- **In-Memory Sandbox Mailbox:** Built-in test inbox that captures emails in development, staging, or CI/CD test runs without hitting real inboxes.

### 3. Workspaces & Granular RBAC

- **Super-Admin & Team Permissions:** Distinct roles with fine-grained access dimensions (`inbox` for support agents, `api` for developers, `tester` for QA engineers).
- **Domain & DNS Assistant:** Easy step-by-step verification for SPF, DKIM, DMARC, and MX records right from the dashboard.

---

## Cloudflare Edge Architecture

EmailFlare replaces heavy server containers with native Cloudflare building blocks:

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 Cloudflare Global Network              │
                  │                                                        │
 Inbound Email ───┼──► Cloudflare Email Routing                            │
                  │             │                                          │
                  │             ▼                                          │
 HTTP / API   ────┼──► [ Unified EmailFlare Worker ]                       │
                  │       ├── Next.js (Dashboard & Team Inbox)             │
                  │       ├── Hono REST API (/api/*, /v1/*)                │
                  │       └── Handlers (Email, Queues, Cron)               │
                  │             │          │            │                  │
                  │             ▼          ▼            ▼                  │
                  │       ┌──────────┐ ┌────────┐ ┌──────────┐             │
                  │       │    D1    │ │   R2   │ │  Queues  │             │
                  │       │ Database │ │ Storage│ │  Engine  │             │
                  │       └──────────┘ └────────┘ └──────────┘             │
                  │             │          │            │                  │
Outbound Email ───┼─────────────┴──────────┴────────────┴─► CF Email MTA   │
                  └────────────────────────────────────────────────────────┘
```

| Cloudflare Primitive    | Role in EmailFlare                                                                                                 |
| :---------------------- | :----------------------------------------------------------------------------------------------------------------- |
| **Worker** (`apps/web`) | Hosts the Next.js web application, Hono REST backend, queue consumers, and cron jobs in one bundle.                |
| **D1**                  | Serverless relational database for users, domains, mailboxes, threads, contacts, API keys, logs, and suppressions. |
| **R2**                  | Object storage for raw inbound email MIME bodies and attachments.                                                  |
| **Queues**              | Asynchronous message queuing for high-throughput, reliable outbound email dispatch.                                |
| **KV**                  | Edge caching and distributed rate-limiting.                                                                        |
| **Durable Objects**     | Live WebSocket connections for instant inbox message synchronization.                                              |

---

## Sending API Quickstart

Sending an email with EmailFlare is as simple as a standard REST call:

### cURL

```bash
curl -X POST https://your-emailflare-worker.workers.dev/v1/send \
  -H "Authorization: Bearer ef_live_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "notifications@yourdomain.com",
    "to": "user@example.com",
    "subject": "Welcome to our platform!",
    "templateId": "welcome-email",
    "variables": {
      "name": "Alex",
      "actionUrl": "https://yourdomain.com/get-started"
    }
  }'
```

### TypeScript / Node.js

```ts
const response = await fetch("https://your-emailflare-worker.workers.dev/v1/send", {
	method: "POST",
	headers: {
		Authorization: `Bearer ${process.env.EMAILFLARE_API_KEY}`,
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		from: "hello@yourdomain.com",
		to: "customer@example.com",
		subject: "Your receipt",
		html: "<p>Thank you for your purchase!</p>",
	}),
});

const data = await response.json();
console.log("Delivered message ID:", data.id);
```

---

## Deployment & Getting Started

### 1. One-Click Cloudflare Deploy

Click the button below to deploy your instance directly into your Cloudflare account:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/0xdps/emailflare)

The deploy button provisions your D1 database, R2 bucket, KV namespace, and queue automatically. Once deployed, open your `workers.dev` URL to complete the initial setup wizard.

For detailed step-by-step instructions, see [**docs/CLOUDFLARE.md**](./docs/CLOUDFLARE.md).

---

### 2. Local Development

EmailFlare includes a convenient task runner via [`just`](https://github.com/casey/just).

#### Prerequisites

- Node.js 22+
- pnpm 11+
- `just` (optional, but recommended: `brew install just`)

```bash
# 1. Clone the repository
git clone https://github.com/0xdps/emailflare.git
cd emailflare

# 2. Install dependencies
just install

# 3. Configure local environment variables
cp apps/web/.dev.vars.example apps/web/.dev.vars

# 4. Apply database migrations to local D1
just web-migrate

# 5. Start the local dev server
just web-dev
```

Open `http://localhost:5173` (or `http://localhost:3000`) in your browser. The initial visit will route to `/setup` where you can create your workspace administrator account.

---

## Repository Layout

```text
apps/web              Unified Cloudflare Worker (Next.js Dashboard + Hono API + Emails & Core Engine)
services/landing      EmailFlare public marketing website (https://emailflare.dev)
migrations            D1 relational database schema definitions
docs                  Architecture deep dives, template guides, and deployment recipes
```

---

## Documentation

- [Cloudflare Deployment Guide](./docs/CLOUDFLARE.md) — Detailed bindings, secrets, and custom domain setup.
- [React Email Templates](./docs/TEMPLATES.md) — How to use and customize built-in email templates.
- [Recipes & Integrations](./docs/RECIPES.md) — Webhooks, outbound relays, and framework integration guides.

---

## License

EmailFlare is open-source software licensed under the [MIT License](./LICENSE).
