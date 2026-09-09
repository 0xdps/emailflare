// Test Mailbox routes — inbox-server deployment.
// GET    /api/test-emails?page=1&limit=50&search=&from=&to=
// GET    /api/test-emails/:id
// DELETE /api/test-emails/:id

import { Hono } from "hono";
import { parsePagination } from "@emailflare/email-core";
import { makeDb, rawDb } from "../db.js";

const app = new Hono();

// GET /api/test-emails — paginated test emails only (is_test = 1)
app.get("/", async (c) => {
	const { page, limit, offset } = parsePagination({ page: c.req.query("page"), limit: c.req.query("limit") });
	const search = c.req.query("search");
	const from = c.req.query("from");
	const to = c.req.query("to");

	const conditions: string[] = ["is_test = 1"];
	const params: unknown[] = [];

	if (from) {
		conditions.push("sent_at >= ?");
		params.push(from);
	}
	if (to) {
		conditions.push("sent_at <= ?");
		params.push(to);
	}
	if (search) {
		conditions.push("(to_address LIKE ? OR from_address LIKE ? OR subject LIKE ?)");
		const like = `%${search}%`;
		params.push(like, like, like);
	}

	const where = `WHERE ${conditions.join(" AND ")}`;

	const [dataResult, countResult] = await Promise.all([
		rawDb.query(`SELECT * FROM email_logs ${where} ORDER BY sent_at DESC LIMIT ? OFFSET ?`, [
			...params,
			limit,
			offset,
		]),
		rawDb.query<{ total: number }>(`SELECT COUNT(*) as total FROM email_logs ${where}`, params),
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

// GET /api/test-emails/:id — single test email detail
app.get("/:id", async (c) => {
	const { emailLogs } = makeDb();
	const log = await emailLogs.findOne({ where: { id: c.req.param("id") } });
	if (!log) return c.json({ error: "Test email not found" }, 404);
	if (log.is_test !== 1) return c.json({ error: "Not a test email" }, 404);
	return c.json(log);
});

// DELETE /api/test-emails/:id — delete a test email
app.delete("/:id", async (c) => {
	const { emailLogs } = makeDb();
	const log = await emailLogs.findOne({ where: { id: c.req.param("id") } });
	if (!log) return c.json({ error: "Test email not found" }, 404);
	if (log.is_test !== 1) return c.json({ error: "Not a test email" }, 400);

	await emailLogs.delete({ where: { id: c.req.param("id") } });
	return c.json({ ok: true });
});

export default app;
