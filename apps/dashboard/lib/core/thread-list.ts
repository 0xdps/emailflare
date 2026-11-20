// Shared SQL for the thread list. The API route and the server-rendered inbox both use this so
// they can never disagree about how conversations are grouped.

const ALL_MESSAGES_CTE = `
	all_messages AS (
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
	)`;

/** Latest non-null value of `column` within the thread, falling back to any value. */
const latest = (column: string, extra = "") =>
	`COALESCE(
		(SELECT ${column} FROM all_messages m2 WHERE m2.thread_id = m.thread_id AND m2.${column} IS NOT NULL ${extra} ORDER BY timestamp DESC LIMIT 1),
		MIN(m.${column})
	)`;

interface Clauses {
	/** `WHERE …` (or empty). */
	where: string;
	/** `HAVING …` (or empty). */
	having: string;
}

/** Binds: …where params, limit, offset. */
export function threadListSql({ where, having }: Clauses): string {
	return `
		WITH ${ALL_MESSAGES_CTE}
		SELECT
			m.thread_id AS id,
			${latest("inbox_address")} AS inbox_address,
			${latest("counterparty_email")} AS counterparty_email,
			${latest("counterparty_name")} AS counterparty_name,
			${latest("person_id")} AS person_id,
			COALESCE(
				(SELECT subject FROM all_messages m2 WHERE m2.thread_id = m.thread_id AND m2.subject IS NOT NULL AND m2.subject != '' ORDER BY timestamp DESC LIMIT 1),
				'(No subject)'
			) AS subject,
			(SELECT body_text FROM all_messages m2 WHERE m2.thread_id = m.thread_id AND m2.body_text IS NOT NULL ORDER BY timestamp DESC LIMIT 1) AS latest_snippet,
			MAX(m.timestamp) AS last_message_at,
			SUM(m.is_unread) AS unread_count,
			COUNT(m.id) AS total_count,
			COALESCE((SELECT is_starred FROM thread_state ts WHERE ts.thread_id = m.thread_id), 0) AS is_starred,
			COALESCE((SELECT is_archived FROM thread_state ts WHERE ts.thread_id = m.thread_id), 0) AS is_archived
		FROM all_messages m
		${where}
		GROUP BY m.thread_id
		${having}
		ORDER BY last_message_at DESC
		LIMIT ? OFFSET ?
	`;
}

/** Binds: …where params. */
export function threadCountSql({ where, having }: Clauses): string {
	return `
		WITH ${ALL_MESSAGES_CTE},
		grouped_threads AS (
			SELECT m.thread_id, SUM(m.is_unread) AS unread_count
			FROM all_messages m
			${where}
			GROUP BY m.thread_id
			${having}
		)
		SELECT COUNT(*) AS total FROM grouped_threads
	`;
}

export interface ThreadListRow {
	id: string;
	inbox_address: string;
	counterparty_email: string;
	counterparty_name: string | null;
	person_id: string | null;
	subject: string | null;
	latest_snippet: string | null;
	last_message_at: string;
	unread_count: number | null;
	total_count: number | null;
	is_starred: number;
	is_archived: number;
}

export function mapThreadRow(r: ThreadListRow) {
	const subject = r.subject || "(No subject)";
	return {
		id: r.id,
		thread_id: r.id,
		subject,
		latest_subject: subject,
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
		is_starred: Number(r.is_starred) === 1,
		is_archived: Number(r.is_archived) === 1,
	};
}
