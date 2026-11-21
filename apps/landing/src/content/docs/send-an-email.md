---
title: Send an email
description: The POST /v1/send reference. Request fields, examples, responses, scheduling, tracking and errors.
section: Send API
order: 40
---

`POST /v1/send` sends one message to one or more recipients. You can send a stored [template](/docs/templates) or raw `html` and `text`.

```http
POST /v1/send
Authorization: Bearer eflive_xxxxxxxxxxxxxxxx
Content-Type: application/json
```

## Request body

| Field                 | Type               | Required | Description                                                                                                                                            |
| --------------------- | ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `from`                | string             | Yes      | Sender address. For a non-global key, its domain must be one the key may use.                                                                          |
| `fromName`            | string             | No       | Display name for the `From` header, for example `Acme`.                                                                                                |
| `to`                  | string or string[] | Yes      | One address, or up to 50. Duplicates are removed. Each recipient gets their own message, so nobody sees the others.                                    |
| `replyTo`             | string             | No       | Address that replies go to.                                                                                                                            |
| `subject`             | string             | See note | Subject line. Overrides a template's subject. Set it for raw `html` or `text` sends.                                                                   |
| `html`                | string             | See note | HTML body. Ignored when you reference a template.                                                                                                      |
| `text`                | string             | See note | Plain-text body. Ignored when you reference a template.                                                                                                |
| `templateSlug`        | string             | See note | Slug of a stored template. Preferred over `templateId`.                                                                                                |
| `templateId`          | string             | See note | ID of a stored template.                                                                                                                               |
| `variables`           | object             | No       | Values for the template's placeholders. Nested objects work with dot paths. Applied to templates only, never to raw `html` or `text`.                  |
| `themeId`             | string             | No       | Colour theme for a built-in layout: `default`, `ocean`, `forest`, `violet` or `slate`. Ignored for custom templates.                                   |
| `listId`              | string             | No       | Audience list ID. Adds one-click unsubscribe headers. See [Unsubscribe and suppressions](/docs/unsubscribe-and-suppressions).                          |
| `listUnsubscribe`     | string             | No       | Your own unsubscribe URL, passed through as the `List-Unsubscribe` header. Used when `listId` is not set, or when the deployment has no `PUBLIC_URL`.  |
| `listUnsubscribePost` | boolean            | No       | Adds `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. Defaults to `true` with `listId`. Set it to `true` yourself when you pass `listUnsubscribe`. |
| `track`               | boolean            | No       | Rewrite links and add an open pixel. Off unless you set it. See [Track opens and clicks](#track-opens-and-clicks).                                     |
| `sendAt`              | string             | No       | ISO 8601 UTC time to deliver, for example `2026-03-01T09:00:00Z`. See [Schedule a send](#schedule-a-send).                                             |

A request must include at least one of `templateSlug`, `templateId`, `html` or `text`. Otherwise it fails validation.

> A request header, `Idempotency-Key`, is also supported. See [Retry safely](#retry-safely).

## Examples

### curl

```bash
curl -X POST https://your-emailflare.workers.dev/v1/send \
  -H "Authorization: Bearer eflive_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "hello@yourdomain.com",
    "fromName": "Acme",
    "to": "alex@example.com",
    "templateSlug": "welcome",
    "themeId": "ocean",
    "variables": { "name": "Alex", "appName": "Acme" }
  }'
```

### JavaScript

```js
const res = await fetch("https://your-emailflare.workers.dev/v1/send", {
	method: "POST",
	headers: {
		Authorization: `Bearer ${process.env.EMAILFLARE_API_KEY}`,
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		from: "hello@yourdomain.com",
		to: "alex@example.com",
		subject: "Your receipt",
		html: "<p>Thanks for your order.</p>",
		text: "Thanks for your order.",
	}),
});

const data = await res.json();
if (!res.ok) throw new Error(data.error ?? `Send failed with ${res.status}`);
```

### Python

```python
import os
import requests

res = requests.post(
    "https://your-emailflare.workers.dev/v1/send",
    headers={"Authorization": f"Bearer {os.environ['EMAILFLARE_API_KEY']}"},
    json={
        "from": "hello@yourdomain.com",
        "to": ["alex@example.com", "sam@example.com"],
        "templateSlug": "magic-link",
        "variables": {"name": "Alex", "appName": "Acme", "magicUrl": "https://acme.com/login?t=abc"},
    },
    timeout=10,
)
res.raise_for_status()
print(res.json()["results"])
```

## Responses

### Sent

```json
{
	"results": [
		{ "to": "alex@example.com", "cfId": "cf_msg_xxxxxxxxxxxx" },
		{ "to": "sam@example.com", "error": "Suppressed: hard_bounce" }
	]
}
```

`cfId` is the message ID from Cloudflare Email Sending. For a test key it is a generated ID. Each recipient has its own entry, with either a `cfId` or an `error`.

The status is `200` when at least one recipient succeeded. If every recipient failed, it is `502`, and the body still lists the per-recipient errors. Check the `results` array, not only the status code.

A recipient can fail because the address is [suppressed](/docs/unsubscribe-and-suppressions), or because Cloudflare rejected the message.

### Errors

| Status | Body                                              | Cause                                                                                                                                  |
| ------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | Validation issues                                 | A field is missing or malformed: an invalid address, more than 50 recipients, or none of `templateSlug`, `templateId`, `html`, `text`. |
| `401`  | `Missing API key` or `Invalid or revoked API key` | No bearer token, or the key is unknown or revoked.                                                                                     |
| `403`  | `API key not authorized for this domain`          | The key's scope does not include the sender domain.                                                                                    |
| `404`  | `Template not found`                              | No template matches `templateSlug` or `templateId`. Slugs are case-sensitive.                                                          |
| `429`  | `Rate limit exceeded`                             | More than 100 requests in 60 seconds for this key.                                                                                     |
| `502`  | `results` with an error per recipient             | Every recipient failed.                                                                                                                |
| `500`  | `Internal server error`                           | Unexpected error. Check the Worker logs with `wrangler tail`.                                                                          |

## Limits

- Up to 50 recipients per request.
- The API has no attachment, `cc` or `bcc` field.
- Sends are logged with the template, key and Cloudflare message ID. Search them under **Activity logs**.

## Schedule a send

Set `sendAt` to a time more than five seconds in the future and the API queues the message instead of sending it.

```json
{
	"from": "hello@yourdomain.com",
	"to": "alex@example.com",
	"subject": "Your trial ends tomorrow",
	"html": "<p>Your trial ends tomorrow.</p>",
	"sendAt": "2026-03-01T09:00:00Z"
}
```

The response is `202`:

```json
{ "scheduled": true, "id": "…", "sendAt": "2026-03-01T09:00:00.000Z" }
```

Things to know:

- Use a UTC timestamp ending in `Z`.
- Scheduling works with live keys. A test key sends immediately.
- Scheduled messages are delivered from the fields you submitted: `from`, `fromName`, `to`, `subject`, `html`, `text` and `replyTo`. Templates, variables and unsubscribe headers are not applied at delivery time, so render the message first and send the final `html`.
- Delivery uses a queue message delay. Cloudflare Queues limit a delay to 12 hours, so schedule within the next 12 hours.
- A successful delivery fires an `email.sent` [webhook](/docs/webhooks).

## Track opens and clicks

Set `track: true` and EmailFlare rewrites every `http` and `https` link in the HTML body to pass through `/v1/t/c/<token>`, and adds a one-pixel image served from `/v1/t/o/<token>`. Tracking applies to the HTML body only.

Opens and clicks fire the `email.opened` and `email.clicked` [webhooks](/docs/webhooks). The links use your deployment's `PUBLIC_URL`, so set it to your public origin first. Image proxies and mail clients that preload images inflate open counts, so treat opens as a rough signal.

## Retry safely

Send an `Idempotency-Key` header and EmailFlare returns the earlier result instead of sending again.

```bash
curl -X POST https://your-emailflare.workers.dev/v1/send \
  -H "Authorization: Bearer eflive_xxx" \
  -H "Idempotency-Key: order-1042-receipt" \
  -H "Content-Type: application/json" \
  -d '{ "from": "hello@yourdomain.com", "to": "alex@example.com", "templateSlug": "order-confirm", "variables": { "orderId": "1042" } }'
```

A repeat request with the same key and the same API key returns `200` with `cached: true` and the first recorded result. Use one recipient per idempotent request, because the cached response lists a single result.
