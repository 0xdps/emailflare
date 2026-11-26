"use server";

import { env } from "cloudflare:workers";
import { generateId, inboxSchema } from "@/lib/core";
import { configureInboxRouting } from "@/worker/inbox/services/domains";
import { requireAdmin } from "./auth";
import type { Env } from "@/worker/inbox/env";

export async function createInboxAction(input: { email: string; display_name: string; mode: "thread" | "individual" }) {
	await requireAdmin();
	const body = inboxSchema.parse(input);
	const workerEnv = env as unknown as Env;

	const existing = await workerEnv.DB.prepare("SELECT id FROM inboxes WHERE email = ? LIMIT 1")
		.bind(body.email)
		.first();
	if (existing) throw new Error("Inbox already exists");

	const routing = await configureInboxRouting(workerEnv, body.email);
	const id = generateId();

	await workerEnv.DB.prepare(
		"INSERT INTO inboxes (id, email, display_name, mode, routing_configured, routing_error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(
			id,
			body.email,
			body.display_name,
			body.mode,
			routing.configured ? 1 : 0,
			routing.error ?? null,
			new Date().toISOString(),
		)
		.run();

	return { id, ...body, routing };
}

export async function retryInboxRoutingAction(id: string) {
	await requireAdmin();
	const workerEnv = env as unknown as Env;

	const row = await workerEnv.DB.prepare("SELECT id, email FROM inboxes WHERE id = ? LIMIT 1").bind(id).first();
	if (!row) throw new Error("Inbox not found");

	const routing = await configureInboxRouting(workerEnv, row.email as string);

	await workerEnv.DB.prepare("UPDATE inboxes SET routing_configured = ?, routing_error = ? WHERE id = ?")
		.bind(routing.configured ? 1 : 0, routing.error ?? null, id)
		.run();

	return { ...row, routing };
}

export async function updateInboxAction(id: string, input: { display_name?: string; mode?: "thread" | "individual" }) {
	await requireAdmin();
	const updates = inboxSchema.partial().parse(input);
	const workerEnv = env as unknown as Env;

	const row = await workerEnv.DB.prepare("SELECT id FROM inboxes WHERE id = ? LIMIT 1").bind(id).first();
	if (!row) throw new Error("Inbox not found");

	const fields = Object.keys(updates) as (keyof typeof updates)[];
	if (!fields.length) throw new Error("No fields to update");

	const set = fields.map((f) => `${f} = ?`).join(", ");
	const values = fields.map((f) => updates[f]);

	await workerEnv.DB.prepare(`UPDATE inboxes SET ${set} WHERE id = ?`)
		.bind(...values, id)
		.run();

	return { ok: true };
}

export async function deleteInboxAction(id: string) {
	await requireAdmin();
	const workerEnv = env as unknown as Env;

	const row = await workerEnv.DB.prepare("SELECT id FROM inboxes WHERE id = ? LIMIT 1").bind(id).first();
	if (!row) throw new Error("Inbox not found");

	await workerEnv.DB.batch([
		workerEnv.DB.prepare("DELETE FROM inbox_members WHERE inbox_id = ?").bind(id),
		workerEnv.DB.prepare("DELETE FROM inboxes WHERE id = ?").bind(id),
	]);

	return { deleted: true };
}

export async function addInboxMemberAction(inboxId: string, userId: string) {
	await requireAdmin();
	const workerEnv = env as unknown as Env;

	const user = await workerEnv.DB.prepare("SELECT id FROM users WHERE id = ? LIMIT 1").bind(userId).first();
	if (!user) throw new Error("User not found");

	await workerEnv.DB.prepare("INSERT OR IGNORE INTO inbox_members (inbox_id, user_id) VALUES (?, ?)")
		.bind(inboxId, userId)
		.run();

	return { ok: true };
}

export async function removeInboxMemberAction(inboxId: string, userId: string) {
	await requireAdmin();
	const workerEnv = env as unknown as Env;

	await workerEnv.DB.prepare("DELETE FROM inbox_members WHERE inbox_id = ? AND user_id = ?")
		.bind(inboxId, userId)
		.run();

	return { deleted: true };
}
