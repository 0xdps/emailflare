import { generateId } from "@/lib/core";

export async function writeAudit(
	db: D1Database,
	entry: {
		actorId?: string | null;
		action: string;
		targetType?: string | null;
		targetId?: string | null;
		detail?: string | null;
	},
): Promise<void> {
	await db
		.prepare(
			"INSERT INTO audit_log (id, actor_id, action, target_type, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		)
		.bind(
			generateId(),
			entry.actorId ?? null,
			entry.action,
			entry.targetType ?? null,
			entry.targetId ?? null,
			entry.detail ?? null,
			new Date().toISOString(),
		)
		.run();
}
