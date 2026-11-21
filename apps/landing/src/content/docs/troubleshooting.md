---
title: Troubleshooting
description: Fixes for 401, 403, 404, 429 and 502 responses, live sends that fail, missing inbound mail and database errors.
section: Operate
order: 140
---

Start with the response body. Most errors name the cause. For anything unexpected, stream the Worker's logs while you repeat the request:

```bash
cd apps/dashboard
pnpm exec wrangler tail
```

## Send API errors

### 401 on `/v1/send`

- Send the header as `Authorization: Bearer <key>`, with one space and nothing else.
- `Missing API key` means the header was absent or did not start with `Bearer `.
- `Invalid or revoked API key` means the hash did not match an active key. Check **API keys** to see whether it was revoked, and copy the key again from where you stored it. A key cannot be shown a second time.

### 403 with a scoped key

The `from` address's domain, or the template's bound domain, is not in the key's domain list. Send from an enabled domain the key covers, or create a key with a wider scope. Use a global key to confirm that scope is the cause, then narrow it again.

### 404 `Template not found`

Copy the slug from the Templates page. Slugs are case-sensitive. Built-in layouts use slugs such as `welcome`, `magic-link` and `otp`. If you created a custom template and the slug was taken, EmailFlare added a suffix. Read the slug in the creation response.

### 400 validation error

Check each address. `to` accepts at most 50 recipients. A request needs a `templateSlug`, `templateId`, `html` or `text`. `sendAt` must be a UTC timestamp ending in `Z`.

### 429 `Rate limit exceeded`

Each key allows 100 requests per 60 seconds. Spread requests out, or send to several recipients in one request. A single call accepts up to 50.

### 502 and `Suppressed: …` in results

Every recipient failed. Read each entry in `results`. A `Suppressed` reason means the address is on the [suppression list](/docs/unsubscribe-and-suppressions). Anything else is the error Cloudflare returned.

## Live sends fail but test sends work

Test keys never call Cloudflare, so a failure that only shows up live points to your Cloudflare setup.

- `CF_API_TOKEN` and `CF_ACCOUNT_ID` are set as secrets on the deployed Worker, and the token has the [permissions it needs](/cloudflare-token).
- The sender domain is enabled and shows a **Verified** badge. See [Domains and DNS](/docs/domains-and-dns).
- The `from` address is on that domain.

## A template looks wrong

- **Placeholders show up empty.** The variable name is misspelled or missing. A missing variable renders as an empty string.
- **A list does not render.** Custom templates do not support `{{#each}}`. Build the repeated HTML in your code and pass it as one variable. See [Templates and variables](/docs/templates#placeholder-syntax).
- **`themeId` has no effect.** It applies only to built-in layouts.
- **A scheduled send ignored my template.** Scheduled sends deliver the `html` and `text` you submit. Render the template first. See [Schedule a send](/docs/send-an-email#schedule-a-send).

## Inbound mail does not arrive

1. The domain shows **Ready to receive**, or you created the catch-all rule by hand.
2. The catch-all rule targets the Worker named in `INBOX_WORKER_NAME`, and that name matches the deployed Worker.
3. A mailbox exists for the address, and you are assigned to it. Admins see every mailbox, members see only theirs.
4. Bounce and complaint reports do not appear as threads by design. Look in **Suppressions** instead.

## Links and invites point to the wrong place

Set `PUBLIC_URL` to your public origin in `wrangler.production.jsonc` and redeploy. Invite, password reset, unsubscribe and tracking links all use it. Keep the production value out of `wrangler.local.jsonc`.

## Unsubscribe headers are missing

`listId` needs `PUBLIC_URL`. Without it, EmailFlare adds no headers for that send. Set `PUBLIC_URL`, or pass your own `listUnsubscribe` URL.

## Database errors

If the logs mention a missing table or column, the database is behind the code. Apply the migrations:

```bash
just dashboard-migrate           # local
just dashboard-migrate-remote    # production
```

A normal `just dashboard-deploy` applies them for you.

## Sign-in problems

- `/setup` creates the first administrator once. After that, people join by invite.
- If you lose your authenticator app, sign in with one of the backup codes you saved when you turned on two-factor sign-in.
- Sessions expire after seven days. Sign in again.

## Still stuck

Search the [issues](https://github.com/0xdps/emailflare/issues). If yours is new, open one with the request you sent (without the key), the status and body you got, and the relevant lines from `wrangler tail`.
