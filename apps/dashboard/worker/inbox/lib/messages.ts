// Shared helpers for message payloads: attach attachment metadata and load
// bodies that were too large for D1 and live in R2.

interface MessageRow {
	id: string;
	body_html?: string | null;
	body_r2_key?: string | null;
	attachments?: unknown[];
}

// D1 allows 100 bound parameters per statement.
const CHUNK = 90;

export async function attachAttachments(db: D1Database, messages: MessageRow[]): Promise<void> {
	const ids = messages.map((m) => m.id);
	const byEmail = new Map<string, unknown[]>();

	for (let i = 0; i < ids.length; i += CHUNK) {
		const chunk = ids.slice(i, i + CHUNK);
		const placeholders = chunk.map(() => "?").join(",");
		const rows = await db
			.prepare(
				`SELECT id, email_id, filename, content_type, size FROM attachments WHERE email_id IN (${placeholders}) ORDER BY created_at, filename`,
			)
			.bind(...chunk)
			.all<{ id: string; email_id: string; filename: string; content_type: string; size: number }>();
		for (const att of rows.results ?? []) {
			const list = byEmail.get(att.email_id) ?? [];
			list.push({ id: att.id, filename: att.filename, content_type: att.content_type, size: att.size });
			byEmail.set(att.email_id, list);
		}
	}

	for (const m of messages) m.attachments = byEmail.get(m.id) ?? [];
}

export async function hydrateLargeBodies(bucket: R2Bucket, messages: MessageRow[]): Promise<void> {
	await Promise.all(
		messages
			.filter((m) => !m.body_html && m.body_r2_key)
			.map(async (m) => {
				const object = await bucket.get(m.body_r2_key as string);
				if (object) m.body_html = await object.text();
			}),
	);
}
