// Inbox templates (reusable reply templates) routes
// GET    /api/inbox/templates
// POST   /api/inbox/templates
// PUT    /api/inbox/templates/:id
// DELETE /api/inbox/templates/:id

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { generateId } from "@emailflare/email-core";
import type { HonoEnv } from "../../env.ts";
import { inboxTemplateSchema } from "@emailflare/inbox-core";

const app = new Hono<HonoEnv>();

// GET /api/inbox/templates
app.get("/", async (c) => {
	const rows = await c.env.DB.prepare("SELECT * FROM inbox_templates ORDER BY created_at DESC").all();
	return c.json(rows.results);
});

// POST /api/inbox/templates
app.post("/", zValidator("json", inboxTemplateSchema), async (c) => {
	const body = c.req.valid("json");
	const existing = await c.env.DB.prepare("SELECT id FROM inbox_templates WHERE slug = ? LIMIT 1")
		.bind(body.slug)
		.first();
	if (existing) return c.json({ error: "Slug already exists" }, 409);

	const id = generateId();
	const now = new Date().toISOString();
	await c.env.DB.prepare(
		"INSERT INTO inbox_templates (id, slug, subject, body_html, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
	)
		.bind(id, body.slug, body.subject, body.body_html, now, now)
		.run();

	return c.json({ id, ...body }, 201);
});

// PUT /api/inbox/templates/:id
app.put("/:id", zValidator("json", inboxTemplateSchema.partial()), async (c) => {
	const row = await c.env.DB.prepare("SELECT id FROM inbox_templates WHERE id = ? LIMIT 1")
		.bind(c.req.param("id"))
		.first();
	if (!row) return c.json({ error: "Template not found" }, 404);

	const body = c.req.valid("json");
	const now = new Date().toISOString();
	const updates: Record<string, unknown> = { updated_at: now };
	if (body.slug) updates.slug = body.slug;
	if (body.subject) updates.subject = body.subject;
	if (body.body_html) updates.body_html = body.body_html;

	const fields = Object.keys(updates);
	const set = fields.map((f) => `${f} = ?`).join(", ");
	await c.env.DB.prepare(`UPDATE inbox_templates SET ${set} WHERE id = ?`)
		.bind(...Object.values(updates), c.req.param("id"))
		.run();
	return c.json({ ok: true });
});

// DELETE /api/inbox/templates/:id
app.delete("/:id", async (c) => {
	const row = await c.env.DB.prepare("SELECT id FROM inbox_templates WHERE id = ? LIMIT 1")
		.bind(c.req.param("id"))
		.first();
	if (!row) return c.json({ error: "Template not found" }, 404);
	await c.env.DB.prepare("DELETE FROM inbox_templates WHERE id = ?").bind(c.req.param("id")).run();
	return c.json({ deleted: true });
});

export default app;
