// Admin routes for the suppression list — inbox deployment.
// GET    /api/suppressions         — paginated list
// POST   /api/suppressions         — manually add an address
// DELETE /api/suppressions/:id     — remove a suppression

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { generateId, parsePagination } from "@/lib/core";
import { makeDb } from "../db.ts";
import { writeAudit } from "../lib/audit.ts";
import type { HonoEnv } from "../env.ts";

const app = new Hono<HonoEnv>();

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
	const { db } = makeDb(c.env.DB);

	const [dataResult, countResult] = await Promise.all([
		db.query(`SELECT * FROM suppressions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [
			...params,
			limit,
			offset,
		]),
		db.query<{ total: number }>(`SELECT COUNT(*) as total FROM suppressions ${where}`, params),
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

app.get("/export.csv", async (c) => {
	const rows = await c.env.DB.prepare(
		"SELECT email, reason, created_at FROM suppressions ORDER BY created_at DESC LIMIT 10000",
	).all<{ email: string; reason: string; created_at: string }>();
	const lines = [
		"email,reason,created_at",
		...(rows.results ?? []).map((row) => `${row.email},${row.reason},${row.created_at}`),
	];
	return new Response(lines.join("\n"), {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": "attachment; filename=suppressions.csv",
		},
	});
});

app.post("/import", async (c) => {
	const text = await c.req.text();
	const emails = [
		...new Set(
			text
				.split(/\r?\n/)
				.map((line) => line.split(",")[0]?.trim().toLowerCase() ?? "")
				.filter((email) => email.includes("@") && !email.startsWith("email")),
		),
	].slice(0, 1000);
	const now = new Date().toISOString();
	let imported = 0;
	for (const email of emails) {
		try {
			await c.env.DB.prepare(
				"INSERT INTO suppressions (id, email, reason, domain_id, email_log_id, created_at) VALUES (?, ?, 'manual', NULL, NULL, ?)",
			)
				.bind(generateId(), email, now)
				.run();
			imported++;
		} catch {
			// Duplicate addresses are skipped.
		}
	}
	await writeAudit(c.env.DB, {
		actorId: c.get("userId"),
		action: "suppression.import",
		targetType: "suppression",
		detail: String(imported),
	});
	return c.json({ imported, skipped: emails.length - imported });
});

// POST /api/suppressions — manual suppression
const addSchema = z.object({
	email: z.string().email(),
	reason: z.enum(["hard_bounce", "soft_bounce", "complaint", "manual", "unsubscribed"]).default("manual"),
	domain_id: z.string().optional(),
});

app.post("/", zValidator("json", addSchema), async (c) => {
	const body = c.req.valid("json");
	const { db } = makeDb(c.env.DB);
	const now = new Date().toISOString();

	try {
		await db.run(
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

	await writeAudit(c.env.DB, {
		actorId: c.get("userId"),
		action: "suppression.create",
		targetType: "suppression",
		detail: body.email.toLowerCase(),
	});
	return c.json({ ok: true }, 201);
});

// DELETE /api/suppressions/:id
app.delete("/:id", async (c) => {
	const { db } = makeDb(c.env.DB);
	await db.run(`DELETE FROM suppressions WHERE id = ?`, [c.req.param("id")]);
	await writeAudit(c.env.DB, {
		actorId: c.get("userId"),
		action: "suppression.delete",
		targetType: "suppression",
		targetId: c.req.param("id"),
	});
	return c.json({ ok: true });
});

export default app;
