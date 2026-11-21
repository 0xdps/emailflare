---
title: Templates and variables
description: Send stored templates by slug. Built-in layouts, custom HTML templates, variables, conditionals and themes.
section: Templates
order: 80
---

A template is a stored message that you reference from `POST /v1/send` with `templateSlug` (preferred, because slugs survive restores) or `templateId`. EmailFlare has two kinds. Browse the built-in layouts in the [template gallery](/templates).

|               | Built-in layout                                          | Custom template                      |
| ------------- | -------------------------------------------------------- | ------------------------------------ |
| Source        | 50 React Email layouts, added by the database migrations | Your own HTML and optional text body |
| Rendered with | React Email                                              | EmailFlare's template renderer       |
| Slug          | The layout name, such as `welcome` or `otp`              | Whatever you choose                  |
| Themes        | `themeId` applies                                        | `themeId` is ignored                 |
| Editable      | No                                                       | Yes                                  |

## Send a template

```json
{
	"from": "hello@yourdomain.com",
	"to": "alex@example.com",
	"templateSlug": "welcome",
	"themeId": "ocean",
	"variables": { "name": "Alex", "appName": "Acme", "loginUrl": "https://acme.com/login" }
}
```

Rules:

- `subject` in the request overrides the template's subject.
- `variables` fill the placeholders in the subject and the body.
- When you reference a template, the request's own `html` and `text` are ignored.
- An unknown slug returns `404 Template not found`. Slugs are case-sensitive.
- A variable you leave out renders as an empty string. It is never printed as `{{name}}`.

## Built-in layouts

The layouts cover onboarding, sign-in codes and magic links, billing and receipts, subscriptions, security alerts, product notices and digests. Each layout has its own variables. The Templates page in the dashboard and the Playground list them, and show a live preview.

Layout subjects are templates too, for example `Welcome to {{appName}}, {{name}}!`. Pass every variable the subject uses, or the subject renders with gaps.

### Themes

Set `themeId` to restyle a layout without editing it: `default`, `ocean`, `forest`, `violet` or `slate`. Custom templates ignore `themeId`.

## Custom templates

Create them under **Templates** in the API workspace, or with the session API.

| Field      | Required | Notes                                   |
| ---------- | -------- | --------------------------------------- |
| `name`     | Yes      | Label shown in the dashboard.           |
| `slug`     | Yes      | Lowercase letters, numbers and hyphens. |
| `subject`  | Yes      | May contain placeholders.               |
| `htmlBody` | Yes      | HTML with placeholders.                 |
| `textBody` | No       | Plain-text version.                     |
| `domainId` | No       | Binds the template to a sending domain. |

If the slug is taken, EmailFlare appends a short suffix, for example `welcome-email-a1b2`. Read the slug from the response.

```text
GET    /api/templates               list
GET    /api/templates/:idOrSlug     fetch one
POST   /api/templates               create
PUT    /api/templates/:id           update
DELETE /api/templates/:id           delete
POST   /api/templates/:id/preview   render with variables
```

These routes need a dashboard session with API access. Built-in layouts cannot be changed or deleted.

```json
{
	"name": "Order confirmation",
	"slug": "order-confirmation",
	"subject": "Your order {{orderId}} is confirmed",
	"htmlBody": "<p>Hi {{name}},</p><p>Order <strong>{{orderId}}</strong> is confirmed.</p>",
	"textBody": "Hi {{name}}, your order {{orderId}} is confirmed."
}
```

### Placeholder syntax

Custom templates use a Handlebars-style syntax that runs without code generation, which Workers do not allow. This is what it supports:

| Syntax                          | Meaning                                |
| ------------------------------- | -------------------------------------- |
| `{{name}}`                      | Insert a variable.                     |
| `{{order.id}}`                  | Read a nested value with a dot path.   |
| `{{#if paid}}…{{else}}…{{/if}}` | Show a block when the value is truthy. |
| `{{#unless paid}}…{{/unless}}`  | Show a block when it is not.           |

Empty strings, `false`, `0`, `null` and empty arrays count as falsy.

Things that do not work: `{{#each}}` loops, `{{#with}}` scoping, partials and custom helpers. To render a list, build the HTML rows in your application and pass them in one variable.

```json
{
	"variables": {
		"rows": "<tr><td>Widget</td><td>$9.00</td></tr><tr><td>Gadget</td><td>$14.50</td></tr>"
	}
}
```

Values are inserted exactly as given. They are not HTML-escaped, so escape any text you got from a user before you pass it.

### Styling

Write styles inline in the HTML. That is the most reliable approach across email clients.

```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
	<h1 style="color: {{brandColor}};">Hello {{name}}</h1>
	<p style="color: #333; line-height: 1.6;">Your order {{orderId}} is confirmed.</p>
</div>
```

To reuse a look across templates, pass colours and fonts as variables, or paste the same wrapper into each template body. There is no shared theme system for custom templates.

## Test before you send

The Playground renders any template with sample variables, and a test key stores the finished message in the [Test mailbox](/docs/test-mailbox-and-playground), so you can check it without delivering anything.
