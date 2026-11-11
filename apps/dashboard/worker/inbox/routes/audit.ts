import { Hono } from "hono";
import { parsePagination } from "@/lib/core";
import type { HonoEnv } from "../env.ts";

const app = new Hono<HonoEnv>();

app.get("/", async (c) => {
	const { page, limit, offset } = parsePagination({ page: c.req.query("page"), limit: c.req.query("limit") });
	const [rows, count] = await Promise.all([
		c.env.DB.prepare(
			`SELECT a.id, a.action, a.target_type, a.target_id, a.detail, a.created_at, u.email AS actor_email
       FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
		)
			.bind(limit, offset)
			.all(),
		c.env.DB.prepare("SELECT COUNT(*) AS total FROM audit_log").first<{ total: number }>(),
	]);
	const total = count?.total ?? 0;
	return c.json({ data: rows.results ?? [], total, page, limit, pages: Math.ceil(total / limit) });
});

export default app;
