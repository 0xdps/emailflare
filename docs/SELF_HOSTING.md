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

# Optional — enable in-house test mailbox (no SMTP/Mailpit needed):
# ENABLE_TEST_MODE=true
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

> **Note:** Test API keys capture email content into the in-house **Test Mailbox** (available in the admin UI under *Monitor → Test Mailbox*). No SMTP server or Mailpit is required.

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

For local development, use `compose.email-api.dev.yaml` instead of `compose.email-api.yaml`. It runs the same stack with hot reload, so test emails are captured in the in-house Test Mailbox and never delivered to real inboxes.

```bash
docker compose --env-file .env.api.local -f compose.email-api.dev.yaml up
# or:
just emailflare-api-dev
```

Once running:

- app: `http://localhost:8090`
- Test Mailbox: `http://localhost:8090/test-emails`

You do not need `CF_API_TOKEN` or `CF_ACCOUNT_ID` set when using the dev stack with test API keys.

---

## Test API keys and the in-house test mailbox

EmailFlare has built-in test mode that works on any deployment (local, Railway, Docker, etc.):

- **Live API keys** send through the Cloudflare Email Sending API
- **Test API keys** capture the email into the in-house Test Mailbox — no Cloudflare credentials or SMTP server required

To use test mode on any deployment:

1. Create a **test** API key from the admin UI (Keys page)
2. Send using that key — the email body is stored in `email_logs` and appears in the Test Mailbox page
3. Inspect or delete test emails from *Monitor → Test Mailbox*