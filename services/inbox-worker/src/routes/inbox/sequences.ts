// Sequence management routes
// GET    /api/inbox/sequences
// POST   /api/inbox/sequences
// PUT    /api/inbox/sequences/:id
// DELETE /api/inbox/sequences/:id
// POST   /api/inbox/sequences/:id/enroll
// DELETE /api/inbox/sequences/enrollments/:enrollmentId

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { generateId } from "@emailflare/email-core";
import type { HonoEnv } from "../../env.ts";
import { sequenceSchema } from "@emailflare/inbox-core";

const app = new Hono<HonoEnv>();

// GET /api/inbox/sequences
app.get("/", async (c) => {
	const rows = await c.env.DB.prepare("SELECT * FROM sequences ORDER BY created_at DESC").all();
	return c.json(rows.results.map((r) => ({ ...r, steps: JSON.parse(r.steps as string) })));
});

// POST /api/inbox/sequences
app.post("/", zValidator("json", sequenceSchema), async (c) => {
	const { name, steps } = c.req.valid("json");
	const id = generateId();
	const now = new Date().toISOString();
	await c.env.DB.prepare("INSERT INTO sequences (id, name, steps, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
		.bind(id, name, JSON.stringify(steps), now, now)
		.run();
	return c.json({ id, name, steps }, 201);
});

// PUT /api/inbox/sequences/:id
app.put("/:id", zValidator("json", sequenceSchema.partial()), async (c) => {
	const row = await c.env.DB.prepare("SELECT id FROM sequences WHERE id = ? LIMIT 1").bind(c.req.param("id")).first();
	if (!row) return c.json({ error: "Sequence not found" }, 404);

	const body = c.req.valid("json");
	const now = new Date().toISOString();
	const updates: Record<string, unknown> = { updated_at: now };
	if (body.name) updates.name = body.name;
	if (body.steps) updates.steps = JSON.stringify(body.steps);

	const fields = Object.keys(updates);
	const set = fields.map((f) => `${f} = ?`).join(", ");
	await c.env.DB.prepare(`UPDATE sequences SET ${set} WHERE id = ?`)
		.bind(...Object.values(updates), c.req.param("id"))
		.run();
	return c.json({ ok: true });
});

// DELETE /api/inbox/sequences/:id
app.delete("/:id", async (c) => {
	const row = await c.env.DB.prepare("SELECT id FROM sequences WHERE id = ? LIMIT 1").bind(c.req.param("id")).first();
	if (!row) return c.json({ error: "Sequence not found" }, 404);
	await c.env.DB.prepare("DELETE FROM sequences WHERE id = ?").bind(c.req.param("id")).run();
	return c.json({ deleted: true });
});

const enrollSchema = z.object({
	personId: z.string(),
	fromAddress: z.string().email(),
	variables: z.record(z.string()).optional(),
});

// POST /api/inbox/sequences/:id/enroll
app.post("/:id/enroll", zValidator("json", enrollSchema), async (c) => {
	const seq = await c.env.DB.prepare("SELECT id FROM sequences WHERE id = ? LIMIT 1").bind(c.req.param("id")).first();
	if (!seq) return c.json({ error: "Sequence not found" }, 404);

	const { personId, fromAddress, variables } = c.req.valid("json");
	const person = await c.env.DB.prepare("SELECT id FROM people WHERE id = ? LIMIT 1").bind(personId).first();
	if (!person) return c.json({ error: "Person not found" }, 404);

	const id = generateId();
	await c.env.DB.prepare(
		`INSERT INTO sequence_enrollments (id, sequence_id, person_id, from_address, variables, current_step, status, enrolled_at)
     VALUES (?, ?, ?, ?, ?, 0, 'active', ?)
     ON CONFLICT (sequence_id, person_id) DO NOTHING`,
	)
		.bind(id, c.req.param("id"), personId, fromAddress, JSON.stringify(variables ?? {}), new Date().toISOString())
		.run();

	return c.json({ ok: true, enrollmentId: id }, 201);
});

// DELETE /api/inbox/sequences/enrollments/:enrollmentId
app.delete("/enrollments/:enrollmentId", async (c) => {
	await c.env.DB.prepare(`UPDATE sequence_enrollments SET status = 'cancelled' WHERE id = ?`)
		.bind(c.req.param("enrollmentId"))
		.run();
	return c.json({ cancelled: true });
});

export default app;
