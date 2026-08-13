# Self-hosting

EmailFlare is intentionally optimized for minimum infrastructure.

The default self-host deployment uses:

- one application container
- embedded mesahub with SQLite-backed storage
- one mounted volume at `/data`
- Cloudflare Email Sending as the outbound delivery provider (for production)

You do not need Postgres, Redis, or a separate database service for the default setup.

## Requirements

- Docker with Compose support
- a Cloudflare account with Email Sending enabled *(not required if using test API keys only)*
- a Cloudflare API token with the required email sending permissions *(not required if using test API keys only)*

## 1. Create your environment file

```bash
cp .env.api.example .env.api.local
```

Set at least:

```text
ADMIN_TOKEN=<openssl rand -hex 32>
SESSION_SECRET=<openssl rand -hex 32>
MESAHUB_URL=mh://local/emailflare
CF_API_TOKEN=<cloudflare token>
CF_ACCOUNT_ID=<cloudflare account id>

# Optional — enable the built-in Mailpit SMTP catcher:
# ENABLE_TEST_MODE=true
# MAILPIT_USER=root          # defaults to root
# MAILPIT_PASS=<secret>      # defaults to ADMIN_TOKEN
```

Notes:

- `MESAHUB_URL=mh://local/emailflare` keeps storage embedded and local to the deployment
- data persists in the Docker volume mounted at `/data`
- keep `ADMIN_TOKEN` and `SESSION_SECRET` at 32+ characters

## 2. Start the production-style stack

```bash
docker compose --env-file .env.local -f compose.email-api.yaml up --build -d
```

Or with `just`:

```bash
just emailflare-api-up
```

## 3. Verify the deployment

```bash
curl http://localhost:8090/health
```

Then open:

- app: `http://localhost:8090`

> **Note:** Mailpit is bundled in the production image but only starts when `ENABLE_TEST_MODE=true`. When enabled it is accessible at `/mailpit/` on the same port as the admin UI, protected by HTTP Basic Auth (defaults to `root` / `ADMIN_TOKEN`). Do not enable it on a public deployment without setting a strong `MAILPIT_PASS`.

## 4. Persist data

The production compose file stores app data in the `app-data` Docker volume.

Back it up with standard Docker volume backup procedures or by snapshotting the host storage where Docker volumes live.

## 5. Updating

If you are running from source:

```bash
git pull
docker compose --env-file .env.local -f compose.email-api.yaml up --build -d
```

If you are running from the published image, pull the new tag and redeploy the container with the same mounted `/data` volume.

## Optional: external mesahub

If you want to move storage out of the app container later, replace `MESAHUB_URL` with an external mesahub URL.

The minimum-infra recommendation remains the embedded local setup until you have a reason to split services.

---

## Local development

For local development, use `compose.email-api.dev.yaml` instead of `compose.email-api.yaml`. It runs the same stack but adds a [Mailpit](https://mailpit.axllent.org) container as the SMTP backend so emails are never delivered to real inboxes.

```bash
docker compose --env-file .env.api.local -f compose.email-api.dev.yaml up
# or:
just emailflare-api-dev
```

Once running:

- app: `http://localhost:8090`
- Mailpit UI: `http://localhost:8090/mailpit/`

You do not need `CF_API_TOKEN` or `CF_ACCOUNT_ID` set when using the dev stack with test API keys.

---

## Test API keys and SMTP routing

EmailFlare has built-in test mode that works on any deployment (local, Railway, Docker, etc.):

- **Live API keys** send through the Cloudflare Email Sending API
- **Test API keys** route sends through SMTP — no Cloudflare credentials required

To use test mode on any deployment:

1. Set `SMTP_HOST` and `SMTP_PORT` to any SMTP catcher ([Mailpit](https://mailpit.axllent.org), [Mailtrap](https://mailtrap.io), etc.)
2. Create a **test** API key from the admin UI (Keys page)
3. Send using that key — emails go to your SMTP catcher, never to real recipients

Optional auth env vars:

```text
SMTP_USER=<username>
SMTP_PASS=<password>
```

Leave them unset for unauthenticated SMTP (e.g. local Mailpit).