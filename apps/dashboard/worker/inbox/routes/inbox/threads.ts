// Threads route — Mailbox is a list of distinct conversation threads
// GET  /api/inbox/threads               — list threads (paginated, search, unread, mailbox filter)
// GET  /api/inbox/threads/:id           — single thread with full message timeline
// POST /api/inbox/threads/:id/mark-read — mark all messages in a thread as read

import { Hono } from "hono";
import { parsePagination } from "@/lib/core";
import type { HonoEnv } from "../../env.ts";

const app = new Hono<HonoEnv>();

// Helper to get assigned inboxes for non-admin members
async function getAssignedInboxes(db: D1Database, userId: string): Promise<string[]> {
	const rows = await db
		.prepare("SELECT i.email FROM inboxes i JOIN inbox_members im ON i.id = im.inbox_id WHERE im.user_id = ?")
		.bind(userId)
		.all<{ email: string }>();
	return (rows.results ?? []).map((r) => r.email);
}

// GET /api/inbox/threads
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
		// If member explicitly requested an inbox, verify they are assigned to it
		if (selectedInbox && !assignedEmails.includes(selectedInbox)) {
			return c.json({ data: [], total: 0, page, limit, pages: 0 });
		}
	}

	const conditions: string[] = [];
	const params: unknown[] = [];

	// Mailbox restriction
	if (selectedInbox) {
		conditions.push("m.inbox_address = ?");
		params.push(selectedInbox);
	} else if (!isAdmin) {
		const placeholders = assignedEmails.map(() => "?").join(",");
		conditions.push(`m.inbox_address IN (${placeholders})`);
		params.push(...assignedEmails);
	}

	if (search) {
		conditions.push(
			"(m.subject LIKE ? OR m.counterparty_email LIKE ? OR m.counterparty_name LIKE ? OR m.body_text LIKE ?)",
		);
		params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
	}

	const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
	const havingClause = unread ? "HAVING unread_count > 0" : "";

	const sql = `
		WITH all_messages AS (
			SELECT
				ie.id,
				ie.thread_id,
				ie.inbox_address,
				COALESCE(p.email, ie.inbox_address) AS counterparty_email,
				p.name AS counterparty_name,
				p.id AS person_id,
				ie.subject,
				ie.body_text,
				ie.received_at AS timestamp,
				CASE WHEN ie.is_read = 0 THEN 1 ELSE 0 END AS is_unread
			FROM inbox_emails ie
			LEFT JOIN people p ON p.id = ie.person_id

			UNION ALL

			SELECT
				se.id,
				se.thread_id,
				se.from_address AS inbox_address,
				se.to_address AS counterparty_email,
				p.name AS counterparty_name,
				p.id AS person_id,
				se.subject,
				se.body_text,
				se.sent_at AS timestamp,
				0 AS is_unread
			FROM sent_inbox_emails se
			LEFT JOIN people p ON p.id = se.person_id
		)
		SELECT
			m.thread_id AS id,
			m.inbox_address,
			m.counterparty_email,
			m.counterparty_name,
			m.person_id,
			COALESCE(
				(SELECT subject FROM all_messages m2 WHERE m2.thread_id = m.thread_id AND m2.subject IS NOT NULL AND m2.subject != '' ORDER BY timestamp DESC LIMIT 1),
				'(No subject)'
			) AS subject,
			(SELECT body_text FROM all_messages m2 WHERE m2.thread_id = m.thread_id AND m2.body_text IS NOT NULL ORDER BY timestamp DESC LIMIT 1) AS latest_snippet,
			MAX(m.timestamp) AS last_message_at,
			SUM(m.is_unread) AS unread_count,
			COUNT(m.id) AS total_count
		FROM all_messages m
		${whereClause}
		GROUP BY m.thread_id, m.inbox_address, m.counterparty_email
		${havingClause}
		ORDER BY last_message_at DESC
		LIMIT ? OFFSET ?
	`;

	params.push(limit, offset);

	const rows = await c.env.DB.prepare(sql)
		.bind(...params)
		.all();

	// Format results for thread client
	const data = (rows.results ?? []).map((r: any) => ({
		id: r.id, // thread_id
		thread_id: r.id,
		subject: r.subject || "(No subject)",
		latest_subject: r.subject || "(No subject)",
		email: r.counterparty_email,
		counterparty_email: r.counterparty_email,
		name: r.counterparty_name,
		counterparty_name: r.counterparty_name,
		person_id: r.person_id,
		inbox_address: r.inbox_address,
		last_message_at: r.last_message_at,
		last_email_at: r.last_message_at,
		unread_count: Number(r.unread_count || 0),
		total_count: Number(r.total_count || 0),
		latest_snippet: r.latest_snippet || null,
	}));

	return c.json({
		data,
		total: data.length, // paged slice
		page,
		limit,
		pages: Math.ceil(data.length / limit),
	});
});

// GET /api/inbox/threads/:id
app.get("/:id", async (c) => {
	const threadId = c.req.param("id");
	const userId = c.get("userId");
	const userType = c.get("userType");
	const isAdmin = userType === "admin";

	let assignedEmails: string[] = [];
	if (!isAdmin) {
		assignedEmails = await getAssignedInboxes(c.env.DB, userId);
		if (assignedEmails.length === 0) {
			return c.json({ error: "Thread not found" }, 404);
		}
	}

	// Fetch all messages in this thread
	const sql = `
		SELECT
			id,
			'inbound' AS direction,
			subject,
			body_html,
			body_text,
			body_r2_key,
			message_id,
			in_reply_to,
			"references",
			thread_id,
			is_read,
			received_at AS timestamp,
			inbox_address,
			person_id,
			spf,
			dkim,
			dmarc
		FROM inbox_emails
		WHERE thread_id = ?

		UNION ALL

		SELECT
			id,
			'outbound' AS direction,
			subject,
			NULL AS body_html,
			body_text,
			NULL AS body_r2_key,
			message_id,
			in_reply_to,
			"references",
			thread_id,
			1 AS is_read,
			sent_at AS timestamp,
			from_address AS inbox_address,
			person_id,
			NULL AS spf,
			NULL AS dkim,
			NULL AS dmarc
		FROM sent_inbox_emails
		WHERE thread_id = ?

		ORDER BY timestamp ASC
	`;

	const rows = await c.env.DB.prepare(sql).bind(threadId, threadId).all();
	let messages = rows.results ?? [];

	// Filter returned rows to assigned addresses for non-admin members
	if (!isAdmin) {
		messages = messages.filter((m: any) => assignedEmails.includes(m.inbox_address));
	}

	if (messages.length === 0) {
		return c.json({ error: "Thread not found" }, 404);
	}

	// Resolve counterparty details
	const personId = messages.find((m: any) => m.person_id)?.person_id;
	let person: any = null;
	if (personId) {
		person = await c.env.DB.prepare("SELECT * FROM people WHERE id = ? LIMIT 1").bind(personId).first<any>();
		if (person && !isAdmin && person.inbox_address && !assignedEmails.includes(person.inbox_address)) {
			person.inbox_address = null;
		}
	}

	const subject = messages.find((m: any) => m.subject)?.subject || "(No subject)";
	const inboundMsg = messages.find((m: any) => m.direction === "inbound");
	const outboundMsg = messages.find((m: any) => m.direction === "outbound");
	const counterpartyEmail =
		person?.email ||
		(inboundMsg as any)?.counterparty_email ||
		(outboundMsg as any)?.to_address ||
		"unknown@recipient.com";

	return c.json({
		id: threadId,
		subject,
		person: person || {
			id: personId || threadId,
			email: counterpartyEmail,
			name: null,
		},
		thread: messages,
		total: messages.length,
	});
});

// POST /api/inbox/threads/:id/mark-read
app.post("/:id/mark-read", async (c) => {
	const threadId = c.req.param("id");
	const userId = c.get("userId");
	const userType = c.get("userType");
	const isAdmin = userType === "admin";

	if (!isAdmin) {
		const assignedEmails = await getAssignedInboxes(c.env.DB, userId);
		if (assignedEmails.length === 0) {
			return c.json({ error: "Thread not found" }, 404);
		}
		const placeholders = assignedEmails.map(() => "?").join(",");
		const emailInThread = await c.env.DB.prepare(
			`SELECT 1 FROM inbox_emails WHERE thread_id = ? AND inbox_address IN (${placeholders}) LIMIT 1`,
		)
			.bind(threadId, ...assignedEmails)
			.first();

		if (!emailInThread) {
			return c.json({ error: "Thread not found" }, 404);
		}

		await c.env.DB.prepare(
			`UPDATE inbox_emails SET is_read = 1 WHERE thread_id = ? AND inbox_address IN (${placeholders})`,
		)
			.bind(threadId, ...assignedEmails)
			.run();
		return c.json({ ok: true });
	}

	await c.env.DB.prepare("UPDATE inbox_emails SET is_read = 1 WHERE thread_id = ?").bind(threadId).run();
	return c.json({ ok: true });
});

export default app;
