// Admin routes for lists (audiences).
// GET    /api/lists         — list all lists
// POST   /api/lists         — create a list
// DELETE /api/lists/:id     — delete a list

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { generateId, listCreateSchema } from "@emailflare/email-core";
import { makeDb } from "../db.ts";
import type { HonoEnv } from "../env.ts";

const app = new Hono<HonoEnv>();

// GET /api/lists
app.get("/", async (c) => {
	const { lists } = makeDb(c.env.DB);
	const rows = await lists.find({ orderBy: [{ column: "created_at", direction: "asc" }] });
	return c.json(rows);
});

// POST /api/lists
app.post("/", zValidator("json", listCreateSchema), async (c) => {
	const { name, slug, description, domainId } = c.req.valid("json");
	const { lists } = makeDb(c.env.DB);

	const row = await lists.insert({
		id: generateId(),
		name,
		slug: slug ?? null,
		description: description ?? null,
		domain_id: domainId ?? null,
		created_at: new Date().toISOString(),
	});

	return c.json(row, 201);
});

// DELETE /api/lists/:id
app.delete("/:id", async (c) => {
	const { lists } = makeDb(c.env.DB);
	const id = c.req.param("id");
	const row = await lists.findOne({ where: { id } });
	if (!row) return c.json({ error: "List not found" }, 404);

	// Keep the opt-outs: a list unsubscribe is the address's only suppression
	// row (suppressions are unique per email), so deleting it would make the
	// recipient mailable again. Detach it from the list instead. Pending
	// tokens for this list are dropped so they can't resolve to a phantom list.
	await c.env.DB.batch([
		c.env.DB.prepare("UPDATE suppressions SET list_id = NULL WHERE list_id = ?").bind(id),
		c.env.DB.prepare("DELETE FROM unsubscribe_tokens WHERE list_id = ?").bind(id),
		c.env.DB.prepare("DELETE FROM lists WHERE id = ?").bind(id),
	]);

	return c.json({ ok: true });
});

export default app;
