# Changelog

All notable changes to EmailFlare are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Design System

- **Themed shadcn end to end:** `components.json`, light + dark tokens (warm neutrals, brand orange, semantic success/warning/info), a type scale and elevation tokens in `app/theme.css`. Geist is now bundled instead of falling back to system fonts.
- **New app shell:** collapsible shadcn sidebar with a workspace switcher, breadcrumb header, account menu with theme switcher, and a ⌘K palette built on `Command`. Navigation is declared once in `lib/nav/config.ts`.
- **Guardrail:** `pnpm lint:ui` blocks new hard-coded palette colours and raw form controls; legacy files are ratcheted in `scripts/ui-baseline.json`.

- **Auth pages migrated:** Login, Setup, Forgot/Reset password, Accept invite and the setup readiness page now use shared `AuthLayout` / form field components built on shadcn primitives and theme tokens.

- **Developer pages migrated:** Overview, Logs, Templates, Playground, Audiences, Suppressions and Deliverability use shared `PageShell`/`PageHeader`/`StatCard` components, semantic status badges and shadcn tables, inputs and tabs. The unused `TestMailbox` page was removed.
- **Admin pages migrated:** Domains, Mailboxes, Team, API keys, Webhooks, Audit log, Security, Contacts and Sequences now use the same primitives and tokens. `pnpm lint:ui` has no grandfathered files left and also rejects arbitrary pixel font sizes.
- **Overview chart:** the hand-written SVG chart is now a shadcn `chart` (Recharts) area chart with theme-aware colours and tooltips.
- **Sidebar:** the inbox mailbox list is now a dropdown (with per-mailbox unread counts) that filters whichever view is open; the collapsed rail centres the logo and shows Compose as an icon.
- `Button` now sets `nativeButton={false}` when given a custom `render` (e.g. a `Link`).

### Security

- **Route guards no longer leak across groups.** `requireAdmin` / `requireApi` were applied to every route mounted after them, so members with inbox access got 403 on all inbox APIs (threads, compose, people…). Each router is now mounted at its own prefix behind exactly one guard (`guarded()`), with regression tests. This also keeps the fixes for the reported member-role issues intact: members cannot list, mint or revoke API keys, and cannot compose from a mailbox they are not assigned to.
- API key creation now requires an explicit `type` and `scope` instead of defaulting to a global live key.

### Fixes

- **Unsubscribes no longer block transactional mail (#194):** an unsubscribe now only blocks sends to its own list (or all list sends and sequences if it has no list). Password resets, login codes and receipts still go out. Bounces, complaints and manual suppressions keep blocking everything.

### Dependencies

- `@hono/zod-validator` 0.9.1, `@types/node` 22.20.5, `prettier` 3.10.1 and `lefthook` 2.2.2. Wrangler stays at 4.157.0 (newer releases are still inside the `minimumReleaseAge` window).

### Inbox

- **Redesigned from scratch:** resizable list/reader panes, date-grouped threads, collapsible messages, one-click sender verification (SPF/DKIM/DMARC) popover, themed HTML mail rendering, toasts with undo, and a shortcuts dialog (`?`).
- **Star, archive and real mark-unread:** new `thread_state` table (migration `0005`), `PATCH /api/inbox/threads/:id/state`, `POST /api/inbox/threads/:id/mark-unread`, `GET /api/inbox/threads/counts`, and `view=inbox|unread|starred|archived` on the thread list. New inbound mail un-archives its thread.
- **Fixes:** the server-rendered inbox no longer lists a thread once per participant, and canned replies now call the correct `/api/inbox/templates` endpoint.

---

## [1.0.0] - 2026-11-07

### Architecture & Edge Infrastructure

- **Single Worker Bundle:** Unified the Next.js web application, Hono REST API, queue consumers, sequence cron, and email routing into a single Cloudflare Worker (`apps/dashboard`).
- **Cloudflare Edge Primitives:** Fully backed by Cloudflare D1 (SQL database), R2 (raw email storage & attachments), KV (rate limiting), Queues (reliable outbound dispatch), and Durable Objects (live WebSocket feeds).
- **1-Click Deployment:** Automatic resource provisioning and D1 database migrations via Cloudflare Workers Builds.

### Transactional Email API

- **REST Sending API:** High-throughput `POST /v1/send` endpoint supporting HTML, plain-text, template slugs, and dynamic variables.
- **50+ React Email Templates:** Built-in responsive templates covering authentication, receipts, security alerts, and newsletters.
- **Custom Handlebars Templates:** Custom template creation with variable interpolation, conditionals, and loops.
- **Interactive Playground:** Sandboxed developer environment for drafting, testing, and previewing sends.
- **Scoped API Keys:** Fine-grained token management with live/test environments and domain-restricted keys (`eflive_...` and `eftest_...`).
- **Deliverability & Reputation:** Automatic bounce classification (hard vs. soft), complaint processing, suppression lists, and RFC 8058 one-click list unsubscribe headers.
- **Developer Console (`/developer/*`):** Dedicated routes for overview metrics, searchable delivery logs, templates, audiences, and suppressions.

### Collaborative Team Inbox

- **Multi-Mailbox Routing:** Create shared addresses (`support@`, `billing@`, `sales@`) with team member assignment.
- **Threaded Conversations:** Real-time grouped conversation threads with live WebSocket update feeds.
- **Secure HTML Viewer:** Inbound emails rendered in a strict `sandbox=""` iframe preventing XSS, with remote tracking pixels blocked until approved.
- **In-App Compose & Reply:** Reply to customer threads and compose new messages directly from assigned domain addresses.
- **Automated Sequences:** Multi-step drip workflows with cron-driven step transitions.
- **Test Mailbox:** In-memory sandbox capturing emails during local development, staging, and CI/CD testing.

### Security & Performance

- **Granular RBAC:** Access dimensions (`inbox`, `api`, `tester`) and administrator roles enforced across server actions and backend routes.
- **Zero-Layout-Shift UI:** Synchronous session cache in `UserContext` and singleton WebSocket connection eliminating skeleton flashes and badge reconnect churn during page transitions.
- **Server-Side Route Protection:** Server-rendered layout guards preventing unauthorized data exposure before hydration.
- **Last-Admin Protection:** Safeguards preventing workspace lockout by blocking demotion or deletion of the last remaining administrator.
