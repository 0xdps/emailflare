# Cloudflare Workers Deployment

EmailFlare deploys as **one single Cloudflare Worker** containing the Next.js web application, Hono REST API, inbound email handler, sequence cron, and outbound send queue.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/0xdps/emailflare)

The 1-Click Deploy button builds and deploys the Worker. Copy `wrangler.local.example.jsonc` to `wrangler.local.jsonc` first if this account needs its own Worker, database, bucket, or queue name. A manual deploy also needs those resources to exist.

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
| **Queue**                     | `EMAIL_QUEUE`   | Sequence delivery jobs. The queue name is set per install in `wrangler.local.jsonc`.                                                                           |
| **KV Namespace**              | `RATE_LIMIT_KV` | Distributed rate limiting and short-lived token storage.                                                                                                       |
| **Durable Object**            | `NOTIFICATIONS` | `NotificationsHub` Durable Object managing persistent real-time WebSocket feeds for the inbox.                                                                 |
| **R2 bucket name**            | —               | Set `bucket_name` on the `ATTACHMENTS` binding in `wrangler.local.jsonc`. Create the bucket before a manual deploy.                                            |

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

3. **Set install-specific names** in `wrangler.local.jsonc` (copy from `wrangler.local.example.jsonc`):
    - `name`: Worker name, if `emailflare` is already taken.
    - `PUBLIC_URL`: public origin, such as `https://mail.yourcompany.com`. Invite, password reset, unsubscribe, and tracking links use this. Set it before inviting teammates; without it, links fall back to the request origin.
    - `CF_DAILY_LIMIT`: daily send ceiling shown on the overview. Defaults to `1000`. Override it in `wrangler.local.jsonc` without a redeploy of application code.
    - `INBOX_WORKER_NAME`: Worker that receives catch-all mail. Keep it equal to `name`.
    - `bucket_name`, `database_name`, and `queue`: only if this account should not use the defaults.

4. **Connect Cloudflare Email Routing:**
    - Domain enable does this when the token can write Email Routing.
    - Otherwise, in the zone, open **Email** > **Email Routing**, create a catch-all, and send it to the Worker named in `INBOX_WORKER_NAME`.

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
