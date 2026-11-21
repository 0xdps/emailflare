---
title: Mailboxes and the shared inbox
description: Add mailboxes, route inbound mail to the Worker, and work threads as a team.
section: Inbox
order: 90
---

The inbox receives mail for the domains you enable and shows it as conversations your team can work together. It sits next to the send API, so one thread can hold what you sent and what the customer replied.

## How inbound mail arrives

1. A message is sent to any address on an enabled domain.
2. Cloudflare Email Routing's catch-all rule hands it to the EmailFlare Worker.
3. The Worker parses the message, finds or creates the sender as a contact, and stores it. Bodies over 512 KB go to R2.
4. If the address matches a mailbox, the thread appears there and open tabs update live.

Domain enable sets up the catch-all rule when the API token allows it. If it could not, add the catch-all by hand and point it at the Worker. See [Domains and DNS](/docs/domains-and-dns).

Bounce and complaint reports use the same path but never show up as threads. They become [suppressions](/docs/unsubscribe-and-suppressions).

## Create a mailbox

A mailbox is one email address, such as `support@yourdomain.com`.

1. Open **Mailboxes** in the admin workspace.
2. Add the address and a display name.
3. Assign the team members who may read and reply from it.

EmailFlare checks the Email Routing setup when you save. If it reports a problem, fix the token or the catch-all rule and run the routing check again from the mailbox.

Admins see every mailbox. Other members see only the mailboxes assigned to them, and can only send from those addresses.

## Work the inbox

The sidebar has three views, a mailbox filter with unread counts, and the Test mailbox if you have access.

| View     | Shows                         |
| -------- | ----------------------------- |
| Inbox    | Active threads, unread first. |
| Starred  | Threads you starred.          |
| Archived | Threads you archived.         |

On a thread you can reply, star it, archive it, or mark it unread. Replying sends from the mailbox address the customer wrote to. A reply carries a thread token in its `Reply-To`, so the customer's answer lands in the same thread.

### Shortcuts

| Key             | Action                   |
| --------------- | ------------------------ |
| `J` / `K`       | Next and previous thread |
| `/`             | Search threads           |
| `C`             | Compose                  |
| `R`             | Reply                    |
| `S`             | Star                     |
| `E`             | Archive                  |
| `U`             | Mark as unread           |
| `Esc`           | Close the thread         |
| `G` then `I`    | Go to the inbox          |
| `⌘K` / `Ctrl K` | Command palette          |

Press the keyboard shortcuts button in the inbox for the full list.

### Canned replies

Save reusable replies as inbox templates, each with a slug, a subject and an HTML body. Insert one from the composer.

### Reading mail safely

HTML mail renders inside a sandboxed frame with no access to your session. Remote images, which often carry tracking pixels, stay blocked until you allow them for that message. Each message shows the SPF, DKIM and DMARC results the sender passed.

## Contacts

Every sender becomes a contact scoped to the mailbox that received their mail. **Contacts** shows the full timeline with a person, both what they sent and what you sent them.

You can import contacts into a mailbox with the session API. Post a CSV with an email column and an optional name column to `/api/inbox/people/import?inbox=support@yourdomain.com`. It reads up to 1,000 rows per request and skips contacts that already exist.

Contacts are the recipients you enroll in [sequences](/docs/sequences).
