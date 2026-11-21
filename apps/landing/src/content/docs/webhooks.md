---
title: Webhooks
description: Get a signed HTTP request when an email is sent, fails, is opened or clicked. Payloads, signatures and limits.
section: Send API
order: 70
---

Webhooks notify your application about email events. EmailFlare sends a signed `POST` to each endpoint that subscribed to the event.

## Register an endpoint

Webhooks are managed by admins under **Webhooks** in the admin workspace.

1. Enter the URL that should receive events. Use HTTPS in production.
2. Choose the events to subscribe to.
3. Copy the signing secret. It is shown once, when you create the webhook.

You can do the same with the session API:

```text
POST   /api/webhooks   { "url": "https://app.example.com/hooks/email", "events": ["email.sent", "email.failed"] }
GET    /api/webhooks
DELETE /api/webhooks/:id
```

Deleting a webhook disables it. Creating and disabling are recorded in the audit log.

## Events

| Event           | Fires when                                                           | `data`                                                                   |
| --------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `email.sent`    | A live or test send was accepted, or a scheduled send was delivered. | `id`, `to`, `from`, `subject`. For scheduled sends: `scheduledId`, `to`. |
| `email.failed`  | Delivery failed for a recipient.                                     | `id`, `to`, `from`, `subject`                                            |
| `email.opened`  | A tracked message's pixel was loaded.                                | `token`, `url`                                                           |
| `email.clicked` | A tracked link was followed.                                         | `token`, `url`                                                           |
| `email.bounced` | Reserved.                                                            | You can subscribe to it, but EmailFlare does not send it yet.            |

Opens and clicks only fire for sends made with `track: true`. See [Send an email](/docs/send-an-email#track-opens-and-clicks). Bounces are recorded as [suppressions](/docs/unsubscribe-and-suppressions) and update the activity log. To react to a bounce, poll the suppression list.

## Payload

Every request has the same envelope.

```json
{
	"id": "Y3k1xT8mQ2wLr9aZpV0bN",
	"event": "email.sent",
	"created_at": "2026-03-01T09:00:02.314Z",
	"data": {
		"id": "G7hN2c0sQp4YtR8uLmX1a",
		"to": "alex@example.com",
		"from": "hello@yourdomain.com",
		"subject": "Welcome to Acme"
	}
}
```

These headers come with it:

```text
Content-Type: application/json
X-EmailFlare-Event: email.sent
X-EmailFlare-Signature: 9f1c…
```

## Verify the signature

`X-EmailFlare-Signature` is the hex-encoded HMAC-SHA256 of the raw request body, using the signing secret as the key. Compute it over the exact bytes you received, before parsing the JSON.

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function verify(rawBody: string, signature: string, secret: string): boolean {
	const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
	const a = Buffer.from(expected);
	const b = Buffer.from(signature);
	return a.length === b.length && timingSafeEqual(a, b);
}
```

In a Worker, use Web Crypto:

```ts
async function verify(rawBody: string, signature: string, secret: string): Promise<boolean> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
	const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
	return expected === signature;
}
```

## Delivery behaviour

- Requests are sent once, without retries. If your endpoint is down, the event is lost. Reply with a `2xx` quickly and do slow work after responding.
- Delivery runs after the original request returns, so it never slows `POST /v1/send`.
- The log of every send is still in **Activity logs**, so you can reconcile after an outage.
