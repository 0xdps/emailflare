# Changelog

All notable changes to EmailFlare are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
