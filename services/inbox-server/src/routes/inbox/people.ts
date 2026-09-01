// People CRM routes
import { Hono } from "hono";
import { rawDb } from "../../db.js";
import type { HonoEnv } from "../../env.js";

const app = new Hono<HonoEnv>();

app.get("/", async (c) => {
	const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
	const limit = Math.min(100, parseInt(c.req.query("limit") ?? "50", 10));
	const offset = (page - 1) * limit;
	const search = c.req.query("search");
	const unread = c.req.query("unread") === "1";

	let sql = `
    SELECT p.id, p.email, p.name, p.created_at,
           COUNT(DISTINCT ie.id) AS email_count,
           SUM(CASE WHEN ie.is_read = 0 THEN 1 ELSE 0 END) AS unread_count,
           MAX(ie.received_at) AS last_activity_at
    FROM people p
    LEFT JOIN inbox_emails ie ON ie.person_id = p.id
  `;
	const params: unknown[] = [];
	const conditions: string[] = [];

	if (search) {
		conditions.push("(p.email LIKE ? OR p.name LIKE ?)");
		params.push(`%${search}%`, `%${search}%`);
	}
	if (unread) conditions.push("ie.is_read = 0");

	if (conditions.length) sql += ` WHERE ${conditions.join(" AND ")}`;
	sql += " GROUP BY p.id ORDER BY last_activity_at DESC LIMIT ? OFFSET ?";
	params.push(limit, offset);

	const [data, count] = await Promise.all([
		rawDb.query(sql, params),
		rawDb.first<{ total: number }>(
			`SELECT COUNT(*) as total FROM people p ${conditions.length ? "LEFT JOIN inbox_emails ie ON ie.person_id = p.id WHERE " + conditions.join(" AND ") : ""}`,
			params.slice(0, -2),
		),
	]);

	return c.json({
		data: data.rows,
		total: count?.total ?? 0,
		page,
		limit,
		pages: Math.ceil((count?.total ?? 0) / limit),
	});
});

app.get("/:id", async (c) => {
	const person = await rawDb.first("SELECT * FROM people WHERE id = ? LIMIT 1", [c.req.param("id")]);
	if (!person) return c.json({ error: "Person not found" }, 404);
	return c.json(person);
});

app.get("/:id/thread", async (c) => {
	const personId = c.req.param("id");
	const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
	const limit = Math.min(100, parseInt(c.req.query("limit") ?? "50", 10));
	const offset = (page - 1) * limit;

	const person = await rawDb.first("SELECT * FROM people WHERE id = ? LIMIT 1", [personId]);
	if (!person) return c.json({ error: "Person not found" }, 404);

	const [thread, count] = await Promise.all([
		rawDb.query(
			`SELECT id, 'inbound' AS direction, subject, body_html, body_text, body_r2_key,
              message_id, in_reply_to, "references", thread_id, is_read, received_at AS timestamp, inbox_address
       FROM inbox_emails WHERE person_id = ?
       UNION ALL
    SELECT id, 'outbound' AS direction, subject, NULL, body_text, NULL,
              message_id, in_reply_to, "references", thread_id, 1, sent_at AS timestamp, from_address AS inbox_address
       FROM sent_inbox_emails WHERE person_id = ?
       ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
			[personId, personId, limit, offset],
		),
		rawDb.first<{ total: number }>(
			`SELECT (SELECT COUNT(*) FROM inbox_emails WHERE person_id = ?) +
              (SELECT COUNT(*) FROM sent_inbox_emails WHERE person_id = ?) AS total`,
			[personId, personId],
		),
	]);

	return c.json({
		person,
		thread: thread.rows,
		total: count?.total ?? 0,
		page,
		limit,
		pages: Math.ceil((count?.total ?? 0) / limit),
	});
});

app.post("/:id/mark-read", async (c) => {
	await rawDb.run("UPDATE inbox_emails SET is_read = 1 WHERE person_id = ?", [c.req.param("id")]);
	return c.json({ ok: true });
});

export default app;
