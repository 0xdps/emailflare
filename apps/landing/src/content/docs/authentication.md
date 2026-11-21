---
title: Authentication and API keys
description: Send requests with a bearer key. Test and live keys, global and domain scopes, revoking and rate limits.
section: Send API
order: 30
---

The send API at `/v1/send` authenticates with an API key in the `Authorization` header.

```http
Authorization: Bearer eflive_xxxxxxxxxxxxxxxx
```

A missing or malformed header returns `401 Missing API key`. An unknown or revoked key returns `401 Invalid or revoked API key`.

Everything under `/api/*` is the dashboard's own API. It uses a session cookie from signing in, not API keys.

## Key types

The prefix tells you what a key does.

| Prefix    | Type | What a send does                                                                                                                                        |
| --------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eftest_` | Test | Renders the message and stores it in the [Test mailbox](/docs/test-mailbox-and-playground). Nothing is delivered. No Cloudflare credentials are needed. |
| `eflive_` | Live | Delivers through Cloudflare Email Sending. Needs `CF_API_TOKEN`, `CF_ACCOUNT_ID` and an enabled domain.                                                 |

## Scopes

Every key has a scope that limits which sender domains it can use.

| Scope        | Allowed sender domains                |
| ------------ | ------------------------------------- |
| Global       | Any domain.                           |
| Domain       | One enabled domain.                   |
| Multi-domain | A list of enabled domains you choose. |

For a non-global key, EmailFlare resolves the domain of the `from` address, or the domain the template is bound to, and checks it against the key's list. A mismatch returns `403 API key not authorized for this domain`.

Prefer the narrowest scope that works. A key for one app should be scoped to the one domain that app sends from.

## Create a key

Only administrators can manage keys.

1. Open **API keys** in the admin workspace.
2. Choose a name, a type and a scope. For Domain and Multi-domain scopes, pick the domains.
3. Copy the key from the dialog.

The key is shown once. EmailFlare keeps a SHA-256 hash and the first 14 characters (the prefix shown in the list) so you can tell keys apart. If you lose a key, create a new one.

## Revoke a key

Revoking a key marks it inactive. Requests with it fail immediately with `401`. The list shows when each key was last used and how many emails it has sent, which helps you find keys that are safe to retire.

## Rate limit

Each key can make 100 requests per 60 seconds. Beyond that, the API returns `429 Rate limit exceeded`. The limit comes from the Workers Rate Limiting binding. If a deployment has no such binding, for example in local development, requests are not limited. The response does not include rate limit headers, so back off and retry when you see a `429`.

## Keep keys private

- Store keys in your server's secret manager or environment, never in client code or a repository.
- The `/v1/*` endpoints allow cross-origin requests from any origin. That makes it easy to call them from a browser, and just as easy to leak a key that way. Call the API from your backend.
- Use separate keys per application and per environment, so you can revoke one without touching the rest.
