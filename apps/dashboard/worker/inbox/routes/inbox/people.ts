// People CRM routes — with strict mailbox membership checks
// GET  /api/inbox/people                    — list people (paginated, search)
// GET  /api/inbox/people/:id                — single person
// GET  /api/inbox/people/:id/thread         — person thread (inbox + sent)
// POST /api/inbox/people/:id/mark-read      — mark all emails read for person

import { Hono } from "hono";
import { parsePagination } from "@/lib/core";
import type { HonoEnv } from "../../env.ts";

const app = new Hono<HonoEnv>();

async function getAssignedInboxes(db: D1Database, userId: string): Promise<string[]> {
	const rows = await db
		.prepare("SELECT i.email FROM inboxes i JOIN inbox_members im ON i.id = im.inbox_id WHERE im.user_id = ?")
		.bind(userId)
		.all<{ email: string }>();
	return (rows.results ?? []).map((r) => r.email);
}

// GET /api/inbox/people
app.get("/", async (c) => {
	const { page, limit, offset } = parsePagination({ page: c.req.query("page"), limit: c.req.query("limit") });
	const search = c.req.query("search");
	const unread = c.req.query("unread") === "1";
	const selectedInbox = c.req.query("inbox");

	const userId = c.get("userId");
	const userType = c.get("userType");
	const isAdmin = userType === "admin";

	let assignedEmails: string[] = [];
	if (!isAdmin) {
		assignedEmails = await getAssignedInboxes(c.env.DB, userId);
		if (assignedEmails.length === 0) {
			return c.json({ data: [], total: 0, page, limit, pages: 0 });
		}
		if (selectedInbox && !assignedEmails.includes(selectedInbox)) {
			return c.json({ data: [], total: 0, page, limit, pages: 0 });
		}
	}

	const conditions: string[] = [];
	const params: unknown[] = [];

	if (selectedInbox) {
		conditions.push("(p.inbox_address = ? OR ie.inbox_address = ?)");
		params.push(selectedInbox, selectedInbox);
	} else if (!isAdmin) {
		const placeholders = assignedEmails.map(() => "?").join(",");
		conditions.push(`(p.inbox_address IN (${placeholders}) OR ie.inbox_address IN (${placeholders}))`);
		params.push(...assignedEmails, ...assignedEmails);
	}

	if (search) {
		conditions.push("(p.email LIKE ? OR p.name LIKE ?)");
		params.push(`%${search}%`, `%${search}%`);
	}
	if (unread) conditions.push("ie.is_read = 0");

	let sql = `
    SELECT p.id, p.email, p.name, p.inbox_address, p.created_at,
           COUNT(DISTINCT ie.id) AS email_count,
           COUNT(DISTINCT ie.id) AS total_count,
           SUM(CASE WHEN ie.is_read = 0 THEN 1 ELSE 0 END) AS unread_count,
           MAX(ie.received_at) AS last_activity_at,
           MAX(ie.received_at) AS last_email_at,
           (SELECT subject FROM inbox_emails WHERE person_id = p.id ORDER BY received_at DESC LIMIT 1) as latest_subject,
           (SELECT body_text FROM inbox_emails WHERE person_id = p.id ORDER BY received_at DESC LIMIT 1) as latest_snippet,
           (SELECT inbox_address FROM inbox_emails WHERE person_id = p.id ORDER BY received_at DESC LIMIT 1) as latest_inbox
    FROM people p
    LEFT JOIN inbox_emails ie ON ie.person_id = p.id
  `;

	if (conditions.length) sql += ` WHERE ${conditions.join(" AND ")}`;
	sql += " GROUP BY p.id ORDER BY last_activity_at DESC NULLS LAST LIMIT ? OFFSET ?";
	params.push(limit, offset);

	const countSql = conditions.length
		? `SELECT COUNT(DISTINCT p.id) as total FROM people p LEFT JOIN inbox_emails ie ON ie.person_id = p.id WHERE ${conditions.join(" AND ")}`
		: `SELECT COUNT(*) as total FROM people`;

	const [data, count] = await Promise.all([
		c.env.DB.prepare(sql)
			.bind(...params)
			.all(),
		c.env.DB.prepare(countSql)
			.bind(...params.slice(0, -2))
			.first<{ total: number }>(),
	]);

	return c.json({
		data: data.results,
		total: count?.total ?? 0,
		page,
		limit,
		pages: Math.ceil((count?.total ?? 0) / limit),
	});
});

// GET /api/inbox/people/:id
app.get("/:id", async (c) => {
	const personId = c.req.param("id");
	const userId = c.get("userId");
	const userType = c.get("userType");
	const isAdmin = userType === "admin";

	if (!isAdmin) {
		const assignedEmails = await getAssignedInboxes(c.env.DB, userId);
		if (assignedEmails.length === 0) return c.json({ error: "Person not found" }, 404);
		const placeholders = assignedEmails.map(() => "?").join(",");
		const memberCheck = await c.env.DB.prepare(
			`SELECT 1 FROM people p
			 LEFT JOIN inbox_emails ie ON ie.person_id = p.id
			 WHERE p.id = ? AND (p.inbox_address IN (${placeholders}) OR ie.inbox_address IN (${placeholders})) LIMIT 1`,
		)
			.bind(personId, ...assignedEmails, ...assignedEmails)
			.first();
		if (!memberCheck) return c.json({ error: "Person not found" }, 404);
	}

	const person = await c.env.DB.prepare("SELECT * FROM people WHERE id = ? LIMIT 1").bind(personId).first();
	if (!person) return c.json({ error: "Person not found" }, 404);
	return c.json(person);
});

// GET /api/inbox/people/:id/thread
app.get("/:id/thread", async (c) => {
	const personId = c.req.param("id");
	const userId = c.get("userId");
	const userType = c.get("userType");
	const isAdmin = userType === "admin";
	const { page, limit, offset } = parsePagination({ page: c.req.query("page"), limit: c.req.query("limit") });

	let assignedEmails: string[] = [];
	if (!isAdmin) {
		assignedEmails = await getAssignedInboxes(c.env.DB, userId);
		if (assignedEmails.length === 0) return c.json({ error: "Person not found" }, 404);
		const placeholders = assignedEmails.map(() => "?").join(",");
		const memberCheck = await c.env.DB.prepare(
			`SELECT 1 FROM people p
			 LEFT JOIN inbox_emails ie ON ie.person_id = p.id
			 WHERE p.id = ? AND (p.inbox_address IN (${placeholders}) OR ie.inbox_address IN (${placeholders})) LIMIT 1`,
		)
			.bind(personId, ...assignedEmails, ...assignedEmails)
			.first();
		if (!memberCheck) return c.json({ error: "Person not found" }, 404);
	}

	const person = await c.env.DB.prepare("SELECT * FROM people WHERE id = ? LIMIT 1").bind(personId).first();
	if (!person) return c.json({ error: "Person not found" }, 404);

	// Merge received + sent, ordered by time
	const thread = await c.env.DB.prepare(
		`
    SELECT id, 'inbound' AS direction, subject, body_html, body_text, body_r2_key,
           message_id, in_reply_to, "references", thread_id, is_read, received_at AS timestamp, inbox_address,
           spf, dkim, dmarc
    FROM inbox_emails WHERE person_id = ?
    UNION ALL
    SELECT id, 'outbound' AS direction, subject, NULL, body_text, NULL,
           message_id, in_reply_to, "references", thread_id, 1, sent_at AS timestamp, from_address AS inbox_address,
           NULL AS spf, NULL AS dkim, NULL AS dmarc
    FROM sent_inbox_emails WHERE person_id = ?
    ORDER BY timestamp DESC LIMIT ? OFFSET ?
  `,
	)
		.bind(personId, personId, limit, offset)
		.all();

	const [count] = await Promise.all([
		c.env.DB.prepare(
			"SELECT (SELECT COUNT(*) FROM inbox_emails WHERE person_id = ?) + (SELECT COUNT(*) FROM sent_inbox_emails WHERE person_id = ?) AS total",
		)
			.bind(personId, personId)
			.first<{ total: number }>(),
	]);

	return c.json({
		person,
		thread: thread.results,
		total: count?.total ?? 0,
		page,
		limit,
		pages: Math.ceil((count?.total ?? 0) / limit),
	});
});

// POST /api/inbox/people/:id/mark-read
app.post("/:id/mark-read", async (c) => {
	const personId = c.req.param("id");
	const userId = c.get("userId");
	const userType = c.get("userType");
	const isAdmin = userType === "admin";

	if (!isAdmin) {
		const assignedEmails = await getAssignedInboxes(c.env.DB, userId);
		if (assignedEmails.length === 0) return c.json({ error: "Person not found" }, 404);
		const placeholders = assignedEmails.map(() => "?").join(",");
		const memberCheck = await c.env.DB.prepare(
			`SELECT 1 FROM inbox_emails WHERE person_id = ? AND inbox_address IN (${placeholders}) LIMIT 1`,
		)
			.bind(personId, ...assignedEmails)
			.first();
		if (!memberCheck) return c.json({ error: "Person not found" }, 404);

		await c.env.DB.prepare(
			`UPDATE inbox_emails SET is_read = 1 WHERE person_id = ? AND inbox_address IN (${placeholders})`,
		)
			.bind(personId, ...assignedEmails)
			.run();
		return c.json({ ok: true });
	}

	await c.env.DB.prepare("UPDATE inbox_emails SET is_read = 1 WHERE person_id = ?").bind(personId).run();
	return c.json({ ok: true });
});

export default app;
