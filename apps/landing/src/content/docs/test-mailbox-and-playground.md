---
title: Test mailbox and playground
description: Try templates and sends without delivering anything. Capture test-key sends and preview layouts in the playground.
section: Send API
order: 50
---

Two tools let you try the API without emailing real people: the Test mailbox and the Playground.

## Test mailbox

Every send made with an `eftest_` key is rendered, logged and stored in the Test mailbox. Nothing leaves your deployment.

- Open **Test mailbox** in the inbox sidebar. You need the `tester` permission. Admins always have it.
- Each entry keeps the HTML and plain-text body, so you can check how a template rendered with real variables.
- Search by recipient, sender or subject.
- Delete one message or clear the whole mailbox. Clearing removes only test messages.

A send to `/v1/send` with a test key goes through the same checks as a live one. Template lookup, variables, suppressions and, for a scoped key, domain limits all apply. A test key with global scope can use any `from` address, so you can test before you enable a domain.

Use test keys in CI and staging so automated runs never reach real inboxes.

## Playground

The Playground is under **Playground** in the API workspace. It is a form for composing a send and seeing the result:

- Pick a template, set variables and, for built-in layouts, a theme.
- Preview the rendered email and the HTML source.
- Copy ready-made `curl`, TypeScript and Python snippets for the same request.
- Send in **Test** mode, which stores the message in the Test mailbox, or in **Live** mode.

Live mode needs an API key. The Playground sends through the same rules as `POST /v1/send` with that key, so a domain-scoped key can only send from its own domain. Paste a test key if you want live mode to stay in the sandbox.

The Playground sends to a single recipient and does not support `html`, `text`, `listId`, `track` or `sendAt`. Use the API for those.

## A suggested workflow

1. Design the template in the Playground against a test key.
2. Check the stored message in the Test mailbox.
3. Send one live message to yourself from a real domain.
4. Switch your application to a live key.
