// Admin routes for the suppression list — inbox-server deployment.
// GET    /api/suppressions         — paginated list
// POST   /api/suppressions         — manually add an address
// DELETE /api/suppressions/:id     — remove a suppression

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { generateId, parsePagination } from "@emailflare/email-core";
import { makeDb, rawDb } from "../db.js";

const app = new Hono();

// GET /api/suppressions?page=1&limit=50&reason=&search=
app.get("/", async (c) => {
	const { page, limit, offset } = parsePagination({ page: c.req.query("page"), limit: c.req.query("limit") });
	const reason = c.req.query("reason");
	const search = c.req.query("search");

	const conditions: string[] = [];
	const params: unknown[] = [];

	if (reason) {
		conditions.push("reason = ?");
		params.push(reason);
	}
	if (search) {
		conditions.push("email LIKE ?");
		params.push(`%${search}%`);
	}

	const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

	const [dataResult, countResult] = await Promise.all([
		rawDb.query(`SELECT * FROM suppressions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [
			...params,
			limit,
			offset,
		]),
		rawDb.query<{ total: number }>(`SELECT COUNT(*) as total FROM suppressions ${where}`, params),
	]);

	const total = countResult.rows[0]?.total ?? 0;

	return c.json({
		data: dataResult.rows,
		total,
		page,
		limit,
		pages: Math.ceil(total / limit),
	});
});

// POST /api/suppressions — manual suppression
const addSchema = z.object({
	email: z.string().email(),
	reason: z.enum(["hard_bounce", "soft_bounce", "complaint", "manual", "unsubscribed"]).default("manual"),
	domain_id: z.string().optional(),
});

app.post("/", zValidator("json", addSchema), async (c) => {
	const body = c.req.valid("json");
	const now = new Date().toISOString();

	try {
		await rawDb.run(
			`INSERT INTO suppressions (id, email, reason, domain_id, email_log_id, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
			[generateId(), body.email.toLowerCase(), body.reason, body.domain_id ?? null, now],
		);
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Unknown error";
		if (msg.includes("UNIQUE")) {
			return c.json({ error: "Address already suppressed" }, 409);
		}
		throw err;
	}

	return c.json({ ok: true }, 201);
});

// DELETE /api/suppressions/:id
app.delete("/:id", async (c) => {
	await rawDb.run(`DELETE FROM suppressions WHERE id = ?`, [c.req.param("id")]);
	return c.json({ ok: true });
});

export default app;
