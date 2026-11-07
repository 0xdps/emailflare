# @emailflare/dashboard

The unified web dashboard and edge engine for EmailFlare, running as a **single Cloudflare Worker**. It combines a Next.js (App Router, via [vinext](https://github.com/cloudflare/vinext)) frontend with a high-performance [Hono](https://hono.dev) REST API backend, live WebSocket Durable Objects, and native Cloudflare email handlers.

---

## Architecture & Responsibilities

The Worker entrypoint in `worker/index.ts` dispatches requests and events based on path and protocol:

1. **Dashboard & Frontend (Next.js via vinext):**
    - **Inbox Dashboard (`/inbox`, `/inbox/sequences`, `/inbox/people`):** Collaborative customer communications, conversation threads, contacts timeline, and automated sequences.
    - **Developer / API Dashboard (`/developer/*`):** Delivery metrics (`/developer/overview`), searchable logs (`/developer/logs`), template designer (`/developer/templates`), interactive playground (`/developer/playground`), audiences (`/developer/lists`), and deliverability suppressions (`/developer/suppressions`).
    - **Admin Management (`/settings/users`, `/inbox/settings`, `/domains`, `/keys`):** User management with granular RBAC, mailbox routing, domain DNS records (SPF, DKIM, DMARC, MX), and API keys.
2. **REST API Backend (`/api/*`, `/v1/*`, `/health`):**
    - Mounted from `worker/inbox` using Hono.
    - Enforces strict Role-Based Access Control (`requireSession`, `requireApi`, `requireAccess("inbox")`, `requireAdmin`).
    - Public send API at `POST /v1/send` with scoped API key authentication (`ef_live_...` and `ef_test_...`).
3. **Inbound Email Handler (`email()`):**
    - Consumes Cloudflare Email Routing events for inbound messages.
    - Parses MIME bodies, saves raw payloads to R2, indexes conversations into D1, and processes bounce/complaint suppression webhooks.
4. **Queue & Cron Handlers (`queue()`, `scheduled()`):**
    - Outbound email dispatch queue for asynchronous, high-volume delivery.
    - Scheduled cron triggers for step transitions in automated onboarding sequences.
5. **Real-Time WebSockets (`NotificationsHub`):**
    - Durable Object managing persistent WebSocket connections for instant live inbox updates.

---

## Security & UI Design

- **Zero-Layout-Shift Navigation:** Client-side navigation uses a cached in-memory and `sessionStorage` session context with a singleton WebSocket, preventing loading skeleton flashes and badge reconnect churn when switching between tabs.
- **Server-Side Authorization:** Every page layout enforces session and RBAC guards on the server before data hydration, ensuring unauthorized members never receive sensitive payload data in initial responses.
- **Inbound HTML Sandboxing:** Emails are rendered inside an isolated `sandbox=""` iframe without `allow-same-origin`, preventing scripts in received emails from accessing application cookies, local storage, or session state. Remote images and tracking pixels are blocked until explicitly authorized by the reader.

---

## Local Development

### 1. Prerequisites

Ensure you have run `just install` at the workspace root to install dependencies. All core logic and React Email templates reside directly in `lib/core/` and `emails/`.

### 2. Configure Local Secrets

Copy the example environment variables:

```bash
cp .dev.vars.example .dev.vars
```

### 3. Apply Local D1 Migrations

Apply the initial schema to your local Miniflare D1 database:

```bash
pnpm migrations:apply:local
```

### 4. Start Development Server

```bash
pnpm dev
```

The app will be available at `http://localhost:5173` (or `http://localhost:3000`). The first visit will direct you to `/setup` to create your initial administrator account.

---

## Production Build & Deployment

```bash
# Typecheck
pnpm exec tsc --noEmit

# Production build
pnpm build

# Deploy to Cloudflare
pnpm deploy
```

During `pnpm deploy`, remote D1 database migrations are applied automatically using the `DB` binding before deploying the Worker bundle.
