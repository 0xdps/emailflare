# Email templates

EmailFlare has two kinds of email templates, and both are referenced the same way
from the send API — by `templateSlug` (or `templateId`):

1. **Built-in layout templates** — 50 curated React Email layouts seeded at first
   run (system templates). Reference them by slug (`welcome`, `magic-link`, `otp`, …).
2. **Custom templates** — your own HTML (and optional plain-text) bodies, written
   with **Handlebars** syntax and stored from the admin UI or the templates API.

This guide focuses on custom templates, then covers how the two kinds interact with
variables and themes.

---

## Custom templates

A custom template has:

| Field      | Required | Notes                                                                                   |
| ---------- | -------- | --------------------------------------------------------------------------------------- |
| `name`     | ✅       | Human-readable label shown in the UI.                                                   |
| `slug`     | ✅       | Stable identifier used by `templateSlug`. Lowercase letters, numbers, and hyphens only. |
| `subject`  | ✅       | Subject line. May contain Handlebars placeholders.                                      |
| `htmlBody` | ✅       | The HTML body. Handlebars placeholders.                                                 |
| `textBody` | —        | Optional plain-text fallback body.                                                      |
| `domainId` | —        | Optionally scope the template to a sending domain.                                      |

> **Slugs are mandatory.** When creating a template, you must provide a slug.
> If you pick a slug that already exists, EmailFlare appends a short suffix
> (e.g. `welcome-email-a1b2`) to keep it unique — so always read the response
> to learn the final slug.

### Variables

Insert values with double curly braces:

```html
<p>Hi {{name}},</p>
<p>Your order <strong>{{orderId}}</strong> is on its way.</p>
```

Pass values via the `variables` object on `/v1/send`:

```json
{
	"to": "alex@example.com",
	"templateSlug": "order-confirmation",
	"variables": { "name": "Alex", "orderId": "ORD-1042" }
}
```

If a variable is missing from the payload, Handlebars renders it as an **empty
string** (it is dropped, not shown as `{{name}}`).

### Loops and conditionals

Because custom templates are rendered with [Handlebars](https://handlebarsjs.com/),
you get the full block syntax — loops, conditionals, and helpers:

```html
{{#if items}}
<ul>
	{{#each items}}
	<li>{{name}} — {{price}}</li>
	{{/each}}
</ul>
{{else}}
<p>Your cart is empty.</p>
{{/if}}
```

`variables` accepts nested objects and arrays, so the example above works with:

```json
{
	"templateSlug": "cart-summary",
	"variables": {
		"items": [
			{ "name": "Widget", "price": "$9.00" },
			{ "name": "Gadget", "price": "$14.50" }
		]
	}
}
```

Built-in helpers (`{{#unless}}`, `{{#with}}`, `{{#each}}`, …) are all available.

### Styling

Custom templates use **inline CSS** — write styles directly in the HTML body.
This is the standard approach for HTML email and the most reliable across email
clients:

```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
	<h1 style="color: #f97316;">Hello {{name}}</h1>
	<p style="color: #333; line-height: 1.6;">Your order {{orderId}} is confirmed.</p>
</div>
```

There is no separate theme system for custom templates — `themeId` on `/v1/send`
only applies to built-in React Email layouts. For reusable styling, you have a
few options:

**Style variables** — pass colours and fonts as template variables:

```html
<h1 style="color: {{primaryColor}}; font-family: {{font}};">Hello {{name}}</h1>
```

```json
{ "variables": { "name": "Alex", "primaryColor": "#f97316", "font": "Arial, sans-serif" } }
```

**Theme object with `{{#with}}`** — pass a nested theme object and scope into it:

```html
{{#with theme}}
<div style="background: {{bg}}; color: {{text}};">
	<h1 style="color: {{primary}};">Hello {{../name}}</h1>
</div>
{{/with}}
```

```json
{
	"variables": {
		"name": "Alex",
		"theme": { "primary": "#f97316", "bg": "#fafafa", "text": "#333" }
	}
}
```

**Base layout in the template** — put your wrapper HTML (header, footer, brand
styles) directly in each template body. Since templates are stored per-slug,
you can copy-paste a consistent base layout across templates.

---

## Built-in layout templates

EmailFlare seeds 50 system templates (one per React Email layout) on first run.
These have a `layout` column set, so they are rendered by the React Email
renderer rather than Handlebars. Their HTML body is empty — the layout _is_ the
content.

Reference them by slug just like custom templates:

```json
{ "to": "alex@example.com", "templateSlug": "welcome", "variables": { "name": "Alex", "appName": "Acme" } }
```

Each layout documents its own variables (visible in the Templates page and
Playground). Common ones include `name`, `appName`, `actionUrl`, and `actionLabel`.

### Themes

Layout templates support colour themes via `themeId`. The available themes are:

`default`, `ocean`, `forest`, `violet`, `slate`.

```json
{ "templateSlug": "welcome", "themeId": "ocean", "variables": { "name": "Alex" } }
```

> `themeId` only applies to layout templates. Custom HTML templates ignore it —
> you control styling directly in the HTML body.

---

## Managing templates

### From the admin UI

Go to **Templates** in the admin UI:

- **Create** — fill in name, slug, subject, HTML body, and optional text body.
  The live preview highlights resolved variables inline.
- **Edit** — update any field; changing the slug checks for collisions.
- **Preview** — render a template with sample variables (and a theme, for layouts).
- **Delete** — remove a custom template. System templates cannot be modified or deleted.

### From the templates API

All admin routes are session-authenticated (`/api/templates`):

```text
GET    /api/templates             # list templates
GET    /api/templates/:idOrSlug   # fetch one (by id or slug)
POST   /api/templates             # create
PUT    /api/templates/:id         # update
DELETE /api/templates/:id         # delete
POST   /api/templates/:id/preview # render with variables + optional themeId
```

Create example:

```json
{
	"name": "Order confirmation",
	"slug": "order-confirmation",
	"subject": "Your order {{orderId}} is confirmed",
	"htmlBody": "<p>Hi {{name}},</p><p>Order <strong>{{orderId}}</strong> is confirmed.</p>",
	"textBody": "Hi {{name}}, your order {{orderId}} is confirmed."
}
```

---

## Sending with a template

Send by slug (preferred — stable across restores) or by id:

```text
POST /v1/send
Authorization: Bearer eflive_xxx
Content-Type: application/json

{
  "from": "hello@yourdomain.com",
  "to": "alex@example.com",
  "templateSlug": "order-confirmation",
  "variables": { "name": "Alex", "orderId": "ORD-1042" }
}
```

Rules:

- `subject` on the send payload overrides the template subject.
- `variables` are applied to both the subject and the body.
- At least one of `templateSlug`, `templateId`, `html`, or `text` must be present.
- Test keys (`eftest_`) capture the rendered email into the Test Mailbox —
  handy for verifying a template without burning real delivery.
