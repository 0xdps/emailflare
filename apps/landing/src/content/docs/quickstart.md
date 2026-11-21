---
title: Quickstart
description: Deploy EmailFlare, create a test key and send an email that lands in the Test mailbox.
section: Start
order: 20
---

This takes you from a fresh deploy to a working `POST /v1/send`. The first four steps need no domain, so you can try the API before touching DNS.

## 1. Deploy

Use the [Deploy to Cloudflare](/cloudflare) button, or follow the manual steps on that page. The deploy creates the Worker and its D1 database, R2 bucket, KV namespace and queue, and applies the database migrations.

## 2. Create the admin account

Open the Worker's `workers.dev` URL. A new install redirects to `/setup`, where you create the first administrator. There is no open sign-up. Everyone else joins by invite.

## 3. Create a test API key

1. Sign in and open **API keys** in the admin workspace.
2. Create a key with type **Test** and scope **Global**.
3. Copy it now. EmailFlare stores only a hash, so the key is shown once.

A test key starts with `eftest_`. Sends made with it are captured in the Test mailbox instead of being delivered.

## 4. Send an email

```bash
curl -X POST https://your-emailflare.workers.dev/v1/send \
  -H "Authorization: Bearer eftest_xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "hello@yourdomain.com",
    "to": "alex@example.com",
    "subject": "Hello from EmailFlare",
    "html": "<p>It works.</p>"
  }'
```

A successful response lists one result per recipient:

```json
{
	"results": [{ "to": "alex@example.com", "cfId": "…" }]
}
```

Open **Test mailbox** in the inbox sidebar to see the captured message. Your account needs the `tester` permission to see it. Admins always have it.

## 5. Connect Cloudflare

Live sending and real domains need a Cloudflare API token and your account ID.

1. [Create an API token](/cloudflare-token) with the permissions listed there.
2. Store both values as Worker secrets:

    ```bash
    just dashboard-secret CF_API_TOKEN
    just dashboard-secret CF_ACCOUNT_ID
    ```

3. Open **Domains** and enable a zone. EmailFlare creates the sending subdomain, writes the DNS records when the token allows it, and points the zone's catch-all at the Worker. See [Domains and DNS](/docs/domains-and-dns).

## 6. Send for real

Create a **Live** key (`eflive_…`), scope it to the domain you enabled, and repeat the request with a `from` address on that domain. The message goes out through Cloudflare Email Sending and appears in the activity logs.

## Next steps

- [Send an email](/docs/send-an-email) for every request field and error.
- [Templates and variables](/docs/templates) to send from stored templates.
- [Mailboxes and the shared inbox](/docs/mailboxes-and-shared-inbox) to receive mail.
