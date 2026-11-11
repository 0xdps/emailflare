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
			COALESCE(
				(SELECT inbox_address FROM all_messages m2 WHERE m2.thread_id = m.thread_id AND m2.inbox_address IS NOT NULL ORDER BY timestamp DESC LIMIT 1),
				MIN(m.inbox_address)
			) AS inbox_address,
			COALESCE(
				(SELECT counterparty_email FROM all_messages m2 WHERE m2.thread_id = m.thread_id AND m2.counterparty_email IS NOT NULL ORDER BY timestamp DESC LIMIT 1),
				MIN(m.counterparty_email)
			) AS counterparty_email,
			COALESCE(
				(SELECT counterparty_name FROM all_messages m2 WHERE m2.thread_id = m.thread_id AND m2.counterparty_name IS NOT NULL ORDER BY timestamp DESC LIMIT 1),
				MIN(m.counterparty_name)
			) AS counterparty_name,
			COALESCE(
				(SELECT person_id FROM all_messages m2 WHERE m2.thread_id = m.thread_id AND m2.person_id IS NOT NULL ORDER BY timestamp DESC LIMIT 1),
				MIN(m.person_id)
			) AS person_id,
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
		GROUP BY m.thread_id
		${havingClause}
		ORDER BY last_message_at DESC
		LIMIT ? OFFSET ?
	`;

	const countSql = `
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
		),
		grouped_threads AS (
			SELECT
				m.thread_id,
				SUM(m.is_unread) AS unread_count
			FROM all_messages m
			${whereClause}
			GROUP BY m.thread_id
			${havingClause}
		)
		SELECT COUNT(*) AS total FROM grouped_threads
	`;

	const [countResult, rows] = await Promise.all([
		c.env.DB.prepare(countSql)
			.bind(...params)
			.first<{ total: number }>(),
		c.env.DB.prepare(sql)
			.bind(...params, limit, offset)
			.all(),
	]);

	const total = Number(countResult?.total ?? 0);

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
		total,
		page,
		limit,
		pages: Math.ceil(total / limit),
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
			ie.id,
			'inbound' AS direction,
			ie.subject,
			ie.body_html,
			ie.body_text,
			ie.body_r2_key,
			ie.message_id,
			ie.in_reply_to,
			ie."references",
			ie.thread_id,
			ie.is_read,
			ie.received_at AS timestamp,
			ie.inbox_address,
			ie.person_id,
			COALESCE(p.email, ie.inbox_address) AS counterparty_email,
			p.name AS counterparty_name,
			NULL AS to_address,
			NULL AS from_address,
			ie.spf,
			ie.dkim,
			ie.dmarc
		FROM inbox_emails ie
		LEFT JOIN people p ON p.id = ie.person_id
		WHERE ie.thread_id = ?

		UNION ALL

		SELECT
			se.id,
			'outbound' AS direction,
			se.subject,
			se.body_html,
			se.body_text,
			NULL AS body_r2_key,
			se.message_id,
			se.in_reply_to,
			se."references",
			se.thread_id,
			1 AS is_read,
			se.sent_at AS timestamp,
			se.from_address AS inbox_address,
			se.person_id,
			se.to_address AS counterparty_email,
			p.name AS counterparty_name,
			se.to_address,
			se.from_address,
			NULL AS spf,
			NULL AS dkim,
			NULL AS dmarc
		FROM sent_inbox_emails se
		LEFT JOIN people p ON p.id = se.person_id
		WHERE se.thread_id = ?

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

	// Populate attachments for messages in this thread
	const emailIds = messages.map((m: any) => m.id);
	if (emailIds.length > 0) {
		const placeholders = emailIds.map(() => "?").join(",");
		const attRows = await c.env.DB.prepare(
			`SELECT id, email_id, filename, content_type, size FROM attachments WHERE email_id IN (${placeholders})`,
		)
			.bind(...emailIds)
			.all();
		const attMap = new Map<string, any[]>();
		for (const att of (attRows.results ?? []) as any[]) {
			const list = attMap.get(att.email_id) ?? [];
			list.push({
				id: att.id,
				filename: att.filename,
				content_type: att.content_type,
				size: att.size,
			});
			attMap.set(att.email_id, list);
		}
		for (const m of messages as any[]) {
			m.attachments = attMap.get(m.id) ?? [];
		}
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
	const counterpartyEmail =
		person?.email ||
		messages.find((m: any) => m.counterparty_email)?.counterparty_email ||
		messages.find((m: any) => m.direction === "outbound" && m.to_address)?.to_address ||
		"unknown@recipient.com";
	const counterpartyName = person?.name || messages.find((m: any) => m.counterparty_name)?.counterparty_name || null;

	return c.json({
		id: threadId,
		subject,
		person: person || {
			id: personId || threadId,
			email: counterpartyEmail,
			name: counterpartyName,
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
