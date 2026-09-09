import { Hono } from "hono";
import { parsePagination } from "@emailflare/email-core";
import { rawDb } from "../db.js";
import type { HonoEnv } from "../env.js";

const app = new Hono<HonoEnv>();

app.get("/", async (c) => {
	const { page, limit, offset } = parsePagination({ page: c.req.query("page"), limit: c.req.query("limit") });
	const domainId = c.req.query("domainId");
	const status = c.req.query("status");
	const templateId = c.req.query("templateId");
	const apiKeyId = c.req.query("apiKeyId");
	const search = c.req.query("search");
	const fromDate = c.req.query("from");
	const toDate = c.req.query("to");

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
		rawDb.query(`SELECT * FROM email_logs ${where} ORDER BY sent_at DESC LIMIT ? OFFSET ?`, [
			...params,
			limit,
			offset,
		]),
		rawDb.query<{ total: number }>(`SELECT COUNT(*) as total FROM email_logs ${where}`, params),
	]);

	const total = countResult.rows[0]?.total ?? 0;
	return c.json({ data: dataResult.rows, total, page, limit, pages: Math.ceil(total / limit) });
});

app.get("/:id", async (c) => {
	const row = await rawDb.first("SELECT * FROM email_logs WHERE id = ? LIMIT 1", [c.req.param("id")]);
	if (!row) return c.json({ error: "Log not found" }, 404);
	return c.json(row);
});

export default app;
