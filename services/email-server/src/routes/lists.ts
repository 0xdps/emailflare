// Admin routes for lists (audiences).
// GET    /api/lists         — list all lists
// POST   /api/lists         — create a list
// DELETE /api/lists/:id     — delete a list

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { lists, suppressions } from "../db.js";
import { generateId, listCreateSchema } from "@emailflare/email-core";

const app = new Hono();

// GET /api/lists
app.get("/", async (c) => {
	const rows = await lists.find({ orderBy: [{ column: "created_at", direction: "asc" }] });
	return c.json(rows);
});

// POST /api/lists
app.post("/", zValidator("json", listCreateSchema), async (c) => {
	const { name, slug, description, domainId } = c.req.valid("json");

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
	const id = c.req.param("id");
	const row = await lists.findOne({ where: { id } });
	if (!row) return c.json({ error: "List not found" }, 404);

	await suppressions.delete({ where: { list_id: id } });
	await lists.delete({ where: { id } });

	return c.json({ ok: true });
});

export default app;
