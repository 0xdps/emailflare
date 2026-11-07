# Cloudflare Workers Deployment

EmailFlare deploys as **one single Cloudflare Worker** containing the Next.js web application, Hono REST API, inbound email handler, sequence cron, and outbound send queue.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/0xdps/emailflare)

The 1-Click Deploy button automatically provisions a fresh D1 database, KV namespace, R2 bucket, and queue in your Cloudflare account, then builds and deploys the unified Worker.

---

## Workers Builds Settings

When connecting your repository to Cloudflare Workers Builds, verify the following configuration:

| Setting               | Value               | Notes                                                  |
| :-------------------- | :------------------ | :----------------------------------------------------- |
| **Root directory**    | `apps/dashboard`    | Location of the unified Worker                         |
| **Build command**     | _(leave empty)_     | Handled automatically by `predeploy` in `package.json` |
| **Deploy command**    | `pnpm run deploy`   | Applies D1 migrations to `DB` binding, then deploys    |
| **Production branch** | `staging` or `main` | Set to your primary repository branch                  |

`pnpm run deploy` automatically applies database migrations from `apps/dashboard/migrations/` to the `DB` binding prior to worker deployment.

---

## What Gets Deployed

| Resource                      | Binding         | Purpose                                                                                                                                                        |
| :---------------------------- | :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Worker** (`apps/dashboard`) | —               | Next.js dashboard (`/inbox`, `/developer/*`, `/settings/*`), Hono REST API (`/api/*`, `/v1/*`), and background handlers (`email()`, `scheduled()`, `queue()`). |
| **D1 Database**               | `DB`            | Relational storage for users, mailboxes, threads, contacts, templates, API keys, domains, logs, and suppressions.                                              |
| **R2 Bucket**                 | `ATTACHMENTS`   | Object storage for raw inbound email MIME messages and file attachments.                                                                                       |
| **Queue**                     | `SEND_QUEUE`    | Outbound email queue producer and consumer for high-throughput, reliable delivery.                                                                             |
| **KV Namespace**              | `RATE_LIMIT_KV` | Distributed rate limiting and short-lived token storage.                                                                                                       |
| **Durable Object**            | `NOTIFICATIONS` | `NotificationsHub` Durable Object managing persistent real-time WebSocket feeds for the inbox.                                                                 |
| **Email Sending**             | `EMAIL`         | Cloudflare's native MTA binding for dispatching outbound emails.                                                                                               |

---

## Post-Deployment Setup

Once the initial deploy completes:

1. **Access Setup Wizard:**
    - Open your deployed `workers.dev` URL (or custom domain).
    - Complete the `/setup` wizard to create your initial workspace Administrator account.

2. **Configure Required Secrets:**
   In your Cloudflare dashboard (or using `wrangler secret put`), configure:

    ```bash
    cd apps/dashboard
    pnpm exec wrangler secret put SESSION_SECRET   # 32+ char random string for session tokens
    pnpm exec wrangler secret put CF_API_TOKEN      # Cloudflare API token with Email Routing & Email Sending permissions
    pnpm exec wrangler secret put CF_ACCOUNT_ID     # Your Cloudflare Account ID
    ```

3. **Set `PUBLIC_URL` (Optional):**
    - If hosting on a custom domain (e.g., `https://mail.yourcompany.com`), set the `PUBLIC_URL` environment variable in your Worker configuration so links in invite and notification emails resolve correctly.

4. **Connect Cloudflare Email Routing:**
    - In the Cloudflare dashboard for your zone, navigate to **Email** > **Email Routing**.
    - Create a catch-all rule (or specific addresses like `support@yourdomain.com`, `billing@...`) and set the action to **Send to Worker**, choosing `emailflare`.

---

## Local Development & Emulation

For local testing, the application runs on Miniflare with emulated D1, KV, and R2 bindings:

```bash
# 1. Install dependencies and build core libraries
just install

# 2. Configure local secrets
cp apps/dashboard/.dev.vars.example apps/dashboard/.dev.vars

# 3. Apply migrations to local SQLite/D1
just dashboard-migrate

# 4. Start local development server
just dashboard-dev
```

The app is accessible locally at `http://localhost:5173`.
