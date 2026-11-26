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
    - Public send API at `POST /v1/send` with scoped API key authentication (`eflive_...` and `eftest_...`).
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
- **Session & 2FA Hardening:** Sessions can be revoked (password change or reset, "Sign out everywhere") through a per-user cut-off in KV. Sign-in is limited per IP and per account (5 failures in 15 minutes locks the account), a TOTP code works once, and backup codes are stored salted.
- **First-run Setup Token:** Set the optional `SETUP_TOKEN` secret and `/setup` asks for it, so nobody can claim the admin account on a fresh public deployment.
- **Signed Tracking Links:** Click-tracking links carry an HMAC of the destination, so `/v1/t/c/*` cannot be used as an open redirect. Unsigned links show a confirmation page instead of redirecting.
- **Bounce Verification:** A message is only treated as a bounce or complaint when it is a real DSN/ARF, passes Cloudflare's SPF/DKIM/DMARC verdict (when available) and refers to a recipient we mailed in the last 7 days. Everything else stays in the inbox.
- **Response Headers:** Every response carries `X-Frame-Options`, `frame-ancestors`, `nosniff`, a referrer policy and HSTS.
- **Domain Monitoring:** Every 30 minutes the cron checks each domain against Cloudflare. A domain whose sending or receiving breaks for two checks in a row is written to the audit log and sent to webhooks as `domain.degraded`, and `domain.recovered` follows when it is healthy again. A failed Cloudflare lookup never counts as a failure, and receiving only counts for domains that have mailboxes.
- **Inbound HTML Sandboxing:** Emails are rendered inside an isolated, script-less sandboxed iframe with its own Content-Security-Policy, so remote images, stylesheets and fonts cannot load (and a message cannot report that it was opened) until the reader chooses "Load images".

---

## Design System

The UI is [shadcn/ui](https://ui.shadcn.com) (Base UI flavour, `components.json`) with one EmailFlare theme.

| Where                      | What                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| `app/theme.css`            | **Only place colours live.** Light + dark tokens, status colours, shadows, type scale.        |
| `components/ui/`           | shadcn primitives. Add with `pnpm dlx shadcn@latest add <name>`; brand tweaks go in variants. |
| `components/app/`          | App shell pieces built from primitives (sidebar, header, theme provider).                     |
| `lib/nav/config.ts`        | Single source for sidebar, breadcrumb, ⌘K palette and `g`-then-key shortcuts.                 |
| `components/modules/inbox` | Inbox feature: list, reader, composer. State lives in `hooks/useInbox*.ts`.                   |

Rules:

- Use semantic tokens (`bg-primary`, `text-muted-foreground`, `bg-success-muted`, `text-2xs`) — never palette classes like `bg-orange-500` or `text-zinc-400`.
- Use `components/ui` primitives instead of raw `<button>`, `<input>`, `<select>`, `<textarea>` or `<table>`.
- To re-brand, edit the variables in `app/theme.css`. Dark mode is the `.dark` block in the same file.
- `pnpm lint:ui` enforces both rules. The baseline in `scripts/ui-baseline.json` is empty — keep it that way (the script also rejects `text-[Npx]` sizes).

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
