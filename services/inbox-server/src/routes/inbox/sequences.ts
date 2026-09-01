// Sequence management routes
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { generateId } from "@emailflare/email-core";
import { rawDb } from "../../db.js";
import type { HonoEnv } from "../../env.js";
import { sequenceSchema } from "@emailflare/inbox-core";

const app = new Hono<HonoEnv>();

app.get("/", async (c) => {
	const { rows } = await rawDb.query("SELECT * FROM sequences ORDER BY created_at DESC");
	return c.json(
		rows.map((r) => ({
			...(r as Record<string, unknown>),
			steps: JSON.parse((r as Record<string, unknown>).steps as string),
		})),
	);
});

app.post("/", zValidator("json", sequenceSchema), async (c) => {
	const { name, steps } = c.req.valid("json");
	const id = generateId();
	const now = new Date().toISOString();
	await rawDb.run("INSERT INTO sequences (id, name, steps, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [
		id,
		name,
		JSON.stringify(steps),
		now,
		now,
	]);
	return c.json({ id, name, steps }, 201);
});

app.put("/:id", zValidator("json", sequenceSchema.partial()), async (c) => {
	const row = await rawDb.first("SELECT id FROM sequences WHERE id = ? LIMIT 1", [c.req.param("id")]);
	if (!row) return c.json({ error: "Sequence not found" }, 404);

	const body = c.req.valid("json");
	const now = new Date().toISOString();
	const updates: Record<string, unknown> = { updated_at: now };
	if (body.name) updates.name = body.name;
	if (body.steps) updates.steps = JSON.stringify(body.steps);

	const fields = Object.keys(updates);
	const set = fields.map((f) => `${f} = ?`).join(", ");
	await rawDb.run(`UPDATE sequences SET ${set} WHERE id = ?`, [...Object.values(updates), c.req.param("id")]);
	return c.json({ ok: true });
});

app.delete("/:id", async (c) => {
	const row = await rawDb.first("SELECT id FROM sequences WHERE id = ? LIMIT 1", [c.req.param("id")]);
	if (!row) return c.json({ error: "Sequence not found" }, 404);
	await rawDb.run("DELETE FROM sequences WHERE id = ?", [c.req.param("id")]);
	return c.json({ deleted: true });
});

const enrollSchema = z.object({
	personId: z.string(),
	fromAddress: z.string().email(),
	variables: z.record(z.string()).optional(),
});

app.post("/:id/enroll", zValidator("json", enrollSchema), async (c) => {
	const seq = await rawDb.first("SELECT id FROM sequences WHERE id = ? LIMIT 1", [c.req.param("id")]);
	if (!seq) return c.json({ error: "Sequence not found" }, 404);

	const { personId, fromAddress, variables } = c.req.valid("json");
	const person = await rawDb.first("SELECT id FROM people WHERE id = ? LIMIT 1", [personId]);
	if (!person) return c.json({ error: "Person not found" }, 404);

	const id = generateId();
	await rawDb.run(
		`INSERT INTO sequence_enrollments
       (id, sequence_id, person_id, from_address, variables, current_step, status, enrolled_at)
     VALUES (?, ?, ?, ?, ?, 0, 'active', ?)
     ON CONFLICT (sequence_id, person_id) DO NOTHING`,
		[id, c.req.param("id"), personId, fromAddress, JSON.stringify(variables ?? {}), new Date().toISOString()],
	);
	return c.json({ ok: true, enrollmentId: id }, 201);
});

app.delete("/enrollments/:enrollmentId", async (c) => {
	await rawDb.run(`UPDATE sequence_enrollments SET status = 'cancelled' WHERE id = ?`, [c.req.param("enrollmentId")]);
	return c.json({ cancelled: true });
});

export default app;
