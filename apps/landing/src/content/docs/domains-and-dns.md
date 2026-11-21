---
title: Domains and DNS
description: Enable a Cloudflare zone for sending and receiving, check its DNS records, and fix common domain problems.
section: Operate
order: 110
---

A domain in EmailFlare is a Cloudflare zone you have enabled for sending, receiving, or both. Enabling is one action. It uses the Cloudflare API token you stored as a Worker secret, so you never paste zone IDs.

## Before you start

- The zone must be in the same Cloudflare account as the token.
- `CF_API_TOKEN` and `CF_ACCOUNT_ID` must be set as Worker secrets. See [Create an API token](/cloudflare-token) for the permissions.
- Only admins can manage domains.

## Enable a zone

1. Open **Domains** in the admin workspace. The page lists the zones your token can read.
2. Choose **Enable** next to a zone.
3. If the zone has no Email Sending subdomain yet, EmailFlare asks which name to use. Use the root, or a subdomain such as `mail.yourdomain.com`.
4. EmailFlare then does three things:
    - Creates the Email Sending subdomain in Cloudflare.
    - Writes the DNS records it needs, when the token allows DNS edits.
    - Enables Email Routing and points the zone's catch-all rule at the Worker.

Each step reports its own status. If Cloudflare rejected a step, the domain is still saved, and the page shows what is left to do.

Each zone shows where it stands:

| Label                 | Meaning                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| Ready to send         | The sending subdomain is enabled.                                                                   |
| Sending needs DNS     | The sending records are not in DNS yet, or Cloudflare is still verifying them.                      |
| Ready to receive      | The catch-all rule delivers inbound mail to the Worker.                                             |
| Receiving needs setup | Add the catch-all rule yourself. See [Connect inbound mail by hand](#connect-inbound-mail-by-hand). |

## DNS records

When EmailFlare cannot write DNS, it lists the records to add. Open **DNS Records** on the domain to see them, add them in your DNS provider, then choose **Verify**. A verified domain shows a **Verified** badge. Until then it shows **Pending DNS**.

The list is whatever Cloudflare returns for the sending subdomain. Add each record exactly as shown. EmailFlare does not create a DMARC record. If you want a DMARC policy, add a `_dmarc` TXT record at your DNS provider.

Cloudflare may take a few minutes to confirm records. Verify again after a short wait before assuming something is wrong.

## Connect inbound mail by hand

If the token could not write Email Routing, set it up in Cloudflare:

1. Open the zone, then **Email** and **Email Routing**.
2. Enable Email Routing and accept the records it asks for.
3. Create a catch-all rule that sends to the Worker named in `INBOX_WORKER_NAME`. It defaults to `emailflare`.

Then open the mailbox in EmailFlare and run the routing setup again.

## Using a domain

- **Sending.** Use an address on the domain as `from`. A domain-scoped API key can only send from its own domains. See [Authentication and API keys](/docs/authentication).
- **Receiving.** Create [mailboxes](/docs/mailboxes-and-shared-inbox) for the addresses you want in the shared inbox.
- **Templates.** A custom template can be bound to a domain with `domainId`.

## Remove a domain

Removing a domain deletes it from EmailFlare and detaches it from any API keys scoped to it. It does not delete the DNS records or the Cloudflare sending subdomain. Remove those in Cloudflare if you no longer want them.

## Common problems

**"Cloudflare token is missing a required permission".** Enabling needs Zone Read, DNS Edit, Email Sending and Email Routing access. Zone Settings Edit is easy to miss, because Cloudflare gates enabling Email Routing behind it. See [Create an API token](/cloudflare-token).

**No zones listed.** The token cannot read any zone. Check its zone resources, and that `CF_API_TOKEN` is set on the deployed Worker, not only in `.dev.vars`.

**Sends fail with a live key but work with a test key.** The domain is not verified, or the token or account ID is wrong. Test keys skip Cloudflare entirely. See [Troubleshooting](/docs/troubleshooting).

**Inbound mail never arrives.** Check that the catch-all rule exists and targets the right Worker name, then send yourself a message and look for it in **Activity logs** and the mailbox.
