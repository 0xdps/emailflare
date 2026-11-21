---
title: Sequences
description: Send a series of timed follow-up emails to contacts, and what happens at each step.
section: Inbox
order: 100
---

A sequence is an ordered list of emails sent to one contact over time, such as an onboarding series or a follow-up after a quote. You enroll a contact, and EmailFlare sends each step when it is due.

## How a sequence runs

- A sequence has a name and one or more steps.
- Each step has a delay in days, a subject, and an HTML or plain-text body.
- When you enroll a contact, EmailFlare records the enrollment time and the address to send from.
- A cron job runs every five minutes. It finds enrollments whose next step is due and queues them. A step is due `delay_days` after the enrollment time, so delays count from enrollment, not from the previous step.
- The queue sends the step through Cloudflare Email Sending, then moves the enrollment to the next step. After the last step the enrollment is marked completed.
- A step with a delay of `0` is due at the next cron run. The next step is sent on a later run, at the earliest.

Each run handles up to 200 active enrollments.

## Personalise steps

Enrollments can carry variables. EmailFlare applies them to the subject and body of every step with the same `{{name}}` placeholder syntax that [templates](/docs/templates#placeholder-syntax) use.

## Unsubscribes and suppressions

Sequences are marketing mail. Before each step, EmailFlare checks the contact against the [suppression list](/docs/unsubscribe-and-suppressions) and any unsubscribe counts. A suppressed contact is skipped and the enrollment moves on.

Each step carries one-click unsubscribe headers when the deployment has `PUBLIC_URL` set, so set it before you run sequences.

## Create and manage sequences

Open **Sequences** in the inbox sidebar. Only admins can create, edit or delete sequences. Inbox users can enroll contacts from mailboxes they can access.

The same actions are available from the session API:

```text
GET    /api/inbox/sequences
POST   /api/inbox/sequences
PUT    /api/inbox/sequences/:id
DELETE /api/inbox/sequences/:id
POST   /api/inbox/sequences/:id/enroll
DELETE /api/inbox/sequences/enrollments/:enrollmentId
```

A sequence body looks like this:

```json
{
	"name": "Trial follow-up",
	"steps": [
		{ "delay_days": 0, "subject": "Welcome, {{name}}", "html": "<p>Glad you're here, {{name}}.</p>" },
		{ "delay_days": 3, "subject": "Need a hand?", "text": "Reply to this email if you get stuck." },
		{ "delay_days": 7, "subject": "Your trial ends soon", "html": "<p>Your trial ends in a week.</p>" }
	]
}
```

To enroll a contact, `POST /api/inbox/sequences/:id/enroll`:

```json
{
	"personId": "CONTACT_ID",
	"fromAddress": "sales@yourdomain.com",
	"variables": { "name": "Alex" }
}
```

A contact can be enrolled in a given sequence once. Cancelling an enrollment, which only admins can do, stops further steps.

## What sequences do not do

Sequences send fixed steps on a schedule. They do not stop when a contact replies and they do not branch on opens or clicks. If you need that, send from your own code with the [send API](/docs/send-an-email).
