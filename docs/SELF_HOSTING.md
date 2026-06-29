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
cp .env.example .env.local
```

Set at least:

```text
ADMIN_TOKEN=<openssl rand -hex 32>
SESSION_SECRET=<openssl rand -hex 32>
MESAHUB_URL=mh://local/emailflare
CF_API_TOKEN=<cloudflare token>
CF_ACCOUNT_ID=<cloudflare account id>
```

Notes:

- `MESAHUB_URL=mh://local/emailflare` keeps storage embedded and local to the deployment
- data persists in the Docker volume mounted at `/data`
- keep `ADMIN_TOKEN` and `SESSION_SECRET` at 32+ characters

## 2. Start the production-style stack

```bash
docker compose --env-file .env.local -f compose.yaml up --build -d
```

Or with `just`:

```bash
just prod
```

## 3. Verify the deployment

```bash
curl http://localhost:8090/health
```

Then open:

- app: `http://localhost:8090`

> **Note:** Test API keys (`eftest_` prefix) store emails in the built-in Test Mailbox instead of sending them. You can view captured test emails in the admin UI at `/test-emails`. No Cloudflare credentials are required for test keys.

## 4. Persist data

The production compose file stores app data in the `app-data` Docker volume.

Back it up with standard Docker volume backup procedures or by snapshotting the host storage where Docker volumes live.

## 5. Updating

If you are running from source:

```bash
git pull
docker compose --env-file .env.local -f compose.yaml up --build -d
```

If you are running from the published image, pull the new tag and redeploy the container with the same mounted `/data` volume.

## Optional: external mesahub

If you want to move storage out of the app container later, replace `MESAHUB_URL` with an external mesahub URL.

The minimum-infra recommendation remains the embedded local setup until you have a reason to split services.

---

## Local development

For local development, use `compose.dev.yaml` instead of `compose.yaml`. It runs the same stack with hot-reload for the backend and admin UI.

```bash
docker compose --env-file .env.local -f compose.dev.yaml up
# or:
just dev
```

Once running:

- app: `http://localhost:8090`
- Test Mailbox: available in the admin UI at `/test-emails`

You do not need `CF_API_TOKEN` or `CF_ACCOUNT_ID` set when using the dev stack with test API keys.

---

## Test API keys

EmailFlare has built-in test mode that works on any deployment (local, Railway, Docker, etc.):

- **Live API keys** send through the Cloudflare Email Sending API
- **Test API keys** (`eftest_` prefix) store emails in the built-in Test Mailbox — no Cloudflare credentials required

To use test mode:

1. Create a **test** API key from the admin UI (Keys page)
2. Send using that key — emails are captured in the Test Mailbox at `/test-emails`, never delivered to real recipients

Test emails include the full rendered HTML and text body, so you can preview exactly what would have been sent.