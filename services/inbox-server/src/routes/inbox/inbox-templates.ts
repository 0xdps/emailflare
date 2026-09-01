// Inbox templates (reusable reply templates)
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { generateId } from "@emailflare/email-core";
import { rawDb } from "../../db.js";
import type { HonoEnv } from "../../env.js";
import { inboxTemplateSchema } from "@emailflare/inbox-core";

const app = new Hono<HonoEnv>();

app.get("/", async (c) => {
	const { rows } = await rawDb.query("SELECT * FROM inbox_templates ORDER BY created_at DESC");
	return c.json(rows);
});

app.post("/", zValidator("json", inboxTemplateSchema), async (c) => {
	const body = c.req.valid("json");
	const existing = await rawDb.first("SELECT id FROM inbox_templates WHERE slug = ? LIMIT 1", [body.slug]);
	if (existing) return c.json({ error: "Slug already exists" }, 409);

	const id = generateId();
	const now = new Date().toISOString();
	await rawDb.run(
		"INSERT INTO inbox_templates (id, slug, subject, body_html, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		[id, body.slug, body.subject, body.body_html, now, now],
	);
	return c.json({ id, ...body }, 201);
});

app.put("/:id", zValidator("json", inboxTemplateSchema.partial()), async (c) => {
	const row = await rawDb.first("SELECT id FROM inbox_templates WHERE id = ? LIMIT 1", [c.req.param("id")]);
	if (!row) return c.json({ error: "Template not found" }, 404);

	const body = c.req.valid("json");
	const now = new Date().toISOString();
	const updates: Record<string, unknown> = { updated_at: now };
	if (body.slug) updates.slug = body.slug;
	if (body.subject) updates.subject = body.subject;
	if (body.body_html) updates.body_html = body.body_html;

	const fields = Object.keys(updates);
	const set = fields.map((f) => `${f} = ?`).join(", ");
	await rawDb.run(`UPDATE inbox_templates SET ${set} WHERE id = ?`, [...Object.values(updates), c.req.param("id")]);
	return c.json({ ok: true });
});

app.delete("/:id", async (c) => {
	const row = await rawDb.first("SELECT id FROM inbox_templates WHERE id = ? LIMIT 1", [c.req.param("id")]);
	if (!row) return c.json({ error: "Template not found" }, 404);
	await rawDb.run("DELETE FROM inbox_templates WHERE id = ?", [c.req.param("id")]);
	return c.json({ deleted: true });
});

export default app;
