---
title: Unsubscribe and suppressions
description: How bounces, complaints and unsubscribes block future sends, and how to add list-based unsubscribe links.
section: Send API
order: 60
---

EmailFlare checks every recipient against a suppression list before it sends. This protects your sender reputation and respects people who opted out.

## What gets suppressed

| Reason         | Created when                                                             | Blocks                          |
| -------------- | ------------------------------------------------------------------------ | ------------------------------- |
| `hard_bounce`  | A permanent failure or a spam rejection bounces back.                    | All mail to that address.       |
| `soft_bounce`  | An address has soft-bounced three times in 30 days.                      | All mail to that address.       |
| `complaint`    | The recipient marks a message as spam and the report reaches EmailFlare. | All mail to that address.       |
| `manual`       | An admin adds the address, or imports a list.                            | All mail to that address.       |
| `unsubscribed` | The recipient uses an unsubscribe link.                                  | Marketing mail only. See below. |

Bounce and complaint messages arrive through Email Routing like any other mail. EmailFlare recognises them, marks the original send as `bounced` or `complained` in the activity log, and never shows them as inbox threads. A bounce is matched to the most recent send to that address within seven days.

## Transactional and marketing mail

An unsubscribe withdraws consent for marketing, so it does not block a password reset or a receipt.

- A send **without** `listId` is transactional. Only bounces, complaints and manual suppressions block it.
- A send **with** `listId` is a list send. It is blocked by bounces, complaints, manual suppressions, and by an unsubscribe from that list or a global unsubscribe.
- [Sequences](/docs/sequences) always count as marketing, so any unsubscribe applies.

A suppressed recipient is not an error for the whole request. Their entry in `results` carries `"error": "Suppressed: <reason>"` and the other recipients are still sent.

## Add one-click unsubscribe to a send

1. Create a list under **Audiences** in the API workspace, or with `POST /api/lists`.
2. Send with that list's ID as `listId`.

```json
{
	"from": "news@yourdomain.com",
	"to": "alex@example.com",
	"templateSlug": "announcement",
	"variables": { "title": "What's new" },
	"listId": "YOUR_LIST_ID"
}
```

For each recipient, EmailFlare creates a single-use token and adds these headers, following RFC 8058:

```text
List-Unsubscribe: <https://your-emailflare.workers.dev/v1/unsubscribe?token=…>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

Mail clients show an unsubscribe button from these headers. EmailFlare does not add a link to the message body, so add a visible unsubscribe link to your template if you need one.

> Unsubscribe links are built from the `PUBLIC_URL` setting. Without it, `listId` adds no headers. Set `PUBLIC_URL` to your public origin, or pass your own URL in `listUnsubscribe`.

### The unsubscribe endpoint

The endpoint is public. The token is the credential, so no API key is needed.

```text
GET  /v1/unsubscribe?token=<token>
POST /v1/unsubscribe?token=<token>
```

- `GET` records the unsubscribe and returns a confirmation page. Use it for links people click.
- `POST` records the unsubscribe and returns `{ "ok": true }`. Mail clients use it for one-click unsubscribe.
- Each token works once. An unknown or used token returns `404`. A missing token returns `400`.

An unsubscribe adds a suppression with the reason `unsubscribed` for the list the token was issued for.

## Manage suppressions

Admins manage the list under **Suppressions** in the API workspace, or through the session API:

```text
GET    /api/suppressions                  list, with ?reason= and ?search=
POST   /api/suppressions                  add an address
DELETE /api/suppressions/:id              remove one
POST   /api/suppressions/import           import a CSV, up to 1,000 addresses
GET    /api/suppressions/export.csv       export up to 10,000 rows
```

Removing a suppression lets you send to that address again. Only do that when you know the cause is fixed, for example a mailbox that was full.

## Manage lists

```text
GET    /api/lists        list all lists
POST   /api/lists        create a list: { "name": "Newsletter", "slug": "newsletter" }
DELETE /api/lists/:id    delete a list and its unsubscribes
```

These routes need a dashboard session with API access.
