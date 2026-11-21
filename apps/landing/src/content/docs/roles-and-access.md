---
title: Roles and access
description: Admins and members, the three access types, and how to invite people, secure sign-in and review the audit log.
section: Operate
order: 120
---

EmailFlare has no open sign-up. The first person to finish setup is an administrator, and everyone else joins by invite.

## Admins and members

Every user is either an **admin** or a **member**.

- **Admins** can do everything, including all three access types below.
- **Members** get only the access types an admin grants them. A member with `inbox` access sees only the mailboxes assigned to them.

## Access types

| Access   | For               | Can use                                                                                      |
| -------- | ----------------- | -------------------------------------------------------------------------------------------- |
| `inbox`  | Support and sales | The shared inbox, contacts, reply templates and sequence enrollment, for assigned mailboxes. |
| `api`    | Developers        | Activity logs, templates, the Playground, audiences and overview stats.                      |
| `tester` | QA                | The Test mailbox.                                                                            |

Some actions are for admins only, whatever access a member has:

- Domains, API keys, webhooks, suppression management and the audit log.
- Inviting, editing and removing users.
- Creating mailboxes and assigning members to them.
- Creating, editing and deleting sequences.

Permissions are read from the database on every request. When you change a member's access or remove them, it takes effect immediately.

## Invite someone

1. Open **Team** in the admin workspace and choose to invite.
2. Enter their email, choose admin or member, and for a member choose the access types.
3. EmailFlare creates an invite link that expires in 48 hours, and emails it when an enabled domain and Cloudflare credentials are available. Otherwise it shows the link so you can send it yourself.

The link uses `PUBLIC_URL`. Set it to your public origin so invite links do not point to `localhost` or the wrong host. The invitee sets a name and password when they accept. Each link works once.

## Two-factor sign-in

Every user can turn on an authenticator app under **Security**. EmailFlare shows a secret to scan, then asks for a code to confirm, and gives you backup codes. Turning it off needs a valid code.

## Audit log

Admins can read the **Audit log** under Compliance. It records who did what and when for sensitive actions, including:

- Invites created
- Webhooks created and disabled
- Suppressions added, imported and removed
- Two-factor sign-in turned on or off
- Password changes

## Sessions

A session lasts seven days and is stored in an HTTP-only cookie. Because EmailFlare re-checks the user's role on each request, a removed user loses access right away.
