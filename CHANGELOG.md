# Changelog

All notable changes to EmailFlare will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release of emailflare-api (transactional email sending + admin dashboard)
- Initial release of emailflare-inbox (team inbox + lightweight CRM)
- Cloudflare Workers deployment path (D1, KV, R2, Durable Objects, Queues)
- Docker self-hosting deployment path (MesaHub SQLite, Redis, BullMQ)
- 50 built-in React Email layout templates
- Custom Handlebars email templates with domain scoping
- API key management with live/test key types and domain scoping
- One-click unsubscribe (RFC 8058) with per-recipient tokens
- Suppression list management
- Email sending logs with status tracking
- Bounce and complaint webhook handling
- Team inbox with thread/individual modes
- Email sequences with step-based automation
- WebSocket notifications for real-time inbox updates
- Web Push notifications (VAPID)
- Attachment storage via Cloudflare R2
- Rate limiting on both Worker and Docker paths
- Admin dashboard with analytics (Recharts)
- Inbox dashboard with contact management
- Railway one-click deploy support
- GitHub Actions CI/CD for Workers and Docker
