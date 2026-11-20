// Threads route — Mailbox is a list of distinct conversation threads
// GET  /api/inbox/threads               — list threads (paginated, search, unread, mailbox filter)
// GET  /api/inbox/threads/:id           — single thread with full message timeline
// POST /api/inbox/threads/:id/mark-read — mark all messages in a thread as read
// POST /api/inbox/threads/:id/mark-unread — mark the latest inbound message as unread
// PATCH /api/inbox/threads/:id/state    — star / archive a thread
// GET  /api/inbox/threads/counts        — sidebar counters per view

import { Hono } from "hono";
import {
	mapThreadRow,
	parsePagination,
	parseThreadView,
	threadCountSql,
	threadListSql,
	threadViewCondition,
	type ThreadListRow,
} from "@/lib/core";
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
	const view = parseThreadView(c.req.query("view"), c.req.query("unread") === "1");
	const unread = view === "unread";
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

	const conditions: string[] = [threadViewCondition(view)];
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

	const clauses = { where: whereClause, having: havingClause };

	const [countResult, rows] = await Promise.all([
		c.env.DB.prepare(threadCountSql(clauses))
			.bind(...params)
			.first<{ total: number }>(),
		c.env.DB.prepare(threadListSql(clauses))
			.bind(...params, limit, offset)
			.all(),
	]);

	const total = Number(countResult?.total ?? 0);

	const data = (rows.results ?? []).map((r) => mapThreadRow(r as unknown as ThreadListRow));

	return c.json({
		data,
		total,
		page,
		limit,
		pages: Math.ceil(total / limit),
	});
});

// GET /api/inbox/threads/counts
app.get("/counts", async (c) => {
	const userId = c.get("userId");
	const isAdmin = c.get("userType") === "admin";

	let scope = "";
	let scopeParams: unknown[] = [];
	if (!isAdmin) {
		const assigned = await getAssignedInboxes(c.env.DB, userId);
		if (assigned.length === 0) return c.json({ unread: 0, starred: 0, perInbox: {} });
		const placeholders = assigned.map(() => "?").join(",");
		scope = `AND inbox_address IN (${placeholders})`;
		scopeParams = assigned;
	}

	const [perInboxRows, starred] = await Promise.all([
		c.env.DB.prepare(
			`SELECT inbox_address, COUNT(DISTINCT thread_id) AS n FROM inbox_emails
			 WHERE is_read = 0 ${scope}
			   AND thread_id NOT IN (SELECT thread_id FROM thread_state WHERE is_archived = 1)
			 GROUP BY inbox_address`,
		)
			.bind(...scopeParams)
			.all<{ inbox_address: string; n: number }>(),
		c.env.DB.prepare(
			`SELECT COUNT(DISTINCT ts.thread_id) AS n FROM thread_state ts
			 WHERE ts.is_starred = 1
			   AND ts.thread_id IN (SELECT thread_id FROM inbox_emails WHERE 1 = 1 ${scope})`,
		)
			.bind(...scopeParams)
			.first<{ n: number }>(),
	]);

	const perInbox: Record<string, number> = {};
	let unread = 0;
	for (const row of perInboxRows.results ?? []) {
		perInbox[row.inbox_address] = Number(row.n);
		unread += Number(row.n);
	}
	return c.json({ unread, starred: Number(starred?.n ?? 0), perInbox });
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

// Admins can touch any thread; members only threads that include one of their mailboxes.
async function canAccessThread(db: D1Database, threadId: string, userId: string, isAdmin: boolean) {
	if (isAdmin) {
		const row = await db
			.prepare(
				"SELECT 1 FROM inbox_emails WHERE thread_id = ? UNION SELECT 1 FROM sent_inbox_emails WHERE thread_id = ? LIMIT 1",
			)
			.bind(threadId, threadId)
			.first();
		return Boolean(row);
	}
	const assigned = await getAssignedInboxes(db, userId);
	if (assigned.length === 0) return false;
	const placeholders = assigned.map(() => "?").join(",");
	const row = await db
		.prepare(
			`SELECT 1 FROM inbox_emails WHERE thread_id = ? AND inbox_address IN (${placeholders})
			 UNION SELECT 1 FROM sent_inbox_emails WHERE thread_id = ? AND from_address IN (${placeholders}) LIMIT 1`,
		)
		.bind(threadId, ...assigned, threadId, ...assigned)
		.first();
	return Boolean(row);
}

// POST /api/inbox/threads/:id/mark-unread
app.post("/:id/mark-unread", async (c) => {
	const threadId = c.req.param("id");
	if (!(await canAccessThread(c.env.DB, threadId, c.get("userId"), c.get("userType") === "admin"))) {
		return c.json({ error: "Thread not found" }, 404);
	}
	await c.env.DB.prepare(
		`UPDATE inbox_emails SET is_read = 0
		 WHERE id = (SELECT id FROM inbox_emails WHERE thread_id = ? ORDER BY received_at DESC LIMIT 1)`,
	)
		.bind(threadId)
		.run();
	return c.json({ ok: true });
});

// PATCH /api/inbox/threads/:id/state  { starred?: boolean, archived?: boolean }
app.patch("/:id/state", async (c) => {
	const threadId = c.req.param("id");
	if (!(await canAccessThread(c.env.DB, threadId, c.get("userId"), c.get("userType") === "admin"))) {
		return c.json({ error: "Thread not found" }, 404);
	}
	const body = await c.req
		.json<{ starred?: unknown; archived?: unknown }>()
		.catch(() => ({}) as Record<string, unknown>);
	const starred = typeof body.starred === "boolean" ? Number(body.starred) : null;
	const archived = typeof body.archived === "boolean" ? Number(body.archived) : null;
	if (starred === null && archived === null) return c.json({ error: "Nothing to update" }, 400);

	await c.env.DB.prepare(
		`INSERT INTO thread_state (thread_id, is_starred, is_archived, updated_at)
		 VALUES (?1, COALESCE(?2, 0), COALESCE(?3, 0), ?4)
		 ON CONFLICT (thread_id) DO UPDATE SET
		   is_starred  = COALESCE(?2, is_starred),
		   is_archived = COALESCE(?3, is_archived),
		   updated_at  = ?4`,
	)
		.bind(threadId, starred, archived, new Date().toISOString())
		.run();
	return c.json({ ok: true });
});

export default app;
