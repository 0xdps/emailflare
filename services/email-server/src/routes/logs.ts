import { Hono } from "hono";
import { parsePagination } from "@emailflare/email-core";
import { db, emailLogs } from "../db.js";

const app = new Hono();

/** Row shape returned by COUNT(*) queries on email_logs. */
interface CountRow {
	total: number;
}

// GET /api/logs?page=1&limit=50&domainId=&status=&templateId=&apiKeyId=&search=&from=&to=
app.get("/", async (c) => {
	const { page, limit, offset } = parsePagination({ page: c.req.query("page"), limit: c.req.query("limit") });
	const domainId = c.req.query("domainId");
	const status = c.req.query("status");
	const templateId = c.req.query("templateId");
	const apiKeyId = c.req.query("apiKeyId");
	const search = c.req.query("search");
	const fromDate = c.req.query("from"); // ISO date string
	const toDate = c.req.query("to"); // ISO date string

	// Build query with optional filters
	const conditions: string[] = [];
	const params: unknown[] = [];

	if (domainId) {
		conditions.push("domain_id = ?");
		params.push(domainId);
	}
	if (status) {
		conditions.push("status = ?");
		params.push(status);
	}
	if (templateId) {
		conditions.push("template_id = ?");
		params.push(templateId);
	}
	if (apiKeyId) {
		conditions.push("api_key_id = ?");
		params.push(apiKeyId);
	}
	if (fromDate) {
		conditions.push("sent_at >= ?");
		params.push(fromDate);
	}
	if (toDate) {
		conditions.push("sent_at <= ?");
		params.push(toDate);
	}
	if (search) {
		conditions.push("(to_address LIKE ? OR from_address LIKE ? OR subject LIKE ?)");
		const like = `%${search}%`;
		params.push(like, like, like);
	}

	const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

	const [dataResult, countResult] = await Promise.all([
		db.query(`SELECT * FROM email_logs ${where} ORDER BY sent_at DESC LIMIT ? OFFSET ?`, [
			...params,
			limit,
			offset,
		]),
		db.query(`SELECT COUNT(*) as total FROM email_logs ${where}`, params),
	]);

	const total = (countResult.rows[0] as unknown as CountRow | undefined)?.total ?? 0;

	return c.json({
		data: dataResult.rows,
		total,
		page,
		limit,
		pages: Math.ceil(total / limit),
	});
});

// GET /api/logs/:id — single log entry detail
app.get("/:id", async (c) => {
	const log = await emailLogs.findOne({ where: { id: c.req.param("id") } });
	if (!log) return c.json({ error: "Log not found" }, 404);
	return c.json(log);
});

export default app;
