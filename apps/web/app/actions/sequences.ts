"use server";

import { env } from "cloudflare:workers";
import { z } from "zod";
import { generateId } from "@emailflare/email-core";
import { sequenceSchema } from "@emailflare/inbox-core";
import type { Env } from "@/worker/inbox/env";
import { requireSession } from "./auth";

const enrollSchema = z.object({
	personId: z.string(),
	fromAddress: z.string().email(),
	variables: z.record(z.string()).optional(),
});

export async function createSequenceAction(data: { name: string; steps: any[] }) {
	await requireSession();
	const parsed = sequenceSchema.safeParse(data);
	if (!parsed.success) {
		return { error: parsed.error.issues[0]?.message ?? "Invalid sequence" };
	}

	const workerEnv = env as unknown as Env;
	const id = generateId();
	const now = new Date().toISOString();

	await workerEnv.DB.prepare("INSERT INTO sequences (id, name, steps, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
		.bind(id, parsed.data.name, JSON.stringify(parsed.data.steps), now, now)
		.run();

	return { data: { id, name: parsed.data.name, steps: parsed.data.steps } };
}

export async function updateSequenceAction(id: string, data: { name?: string; steps?: any[] }) {
	await requireSession();
	const parsed = sequenceSchema.partial().safeParse(data);
	if (!parsed.success) {
		return { error: parsed.error.issues[0]?.message ?? "Invalid sequence update" };
	}

	const workerEnv = env as unknown as Env;
	const row = await workerEnv.DB.prepare("SELECT id FROM sequences WHERE id = ? LIMIT 1").bind(id).first();
	if (!row) {
		return { error: "Sequence not found" };
	}

	const now = new Date().toISOString();
	const updates: Record<string, unknown> = { updated_at: now };
	if (parsed.data.name) updates.name = parsed.data.name;
	if (parsed.data.steps) updates.steps = JSON.stringify(parsed.data.steps);

	const fields = Object.keys(updates);
	const set = fields.map((f) => `${f} = ?`).join(", ");
	await workerEnv.DB.prepare(`UPDATE sequences SET ${set} WHERE id = ?`)
		.bind(...Object.values(updates), id)
		.run();

	return { success: true };
}

export async function deleteSequenceAction(id: string) {
	await requireSession();
	const workerEnv = env as unknown as Env;
	const row = await workerEnv.DB.prepare("SELECT id FROM sequences WHERE id = ? LIMIT 1").bind(id).first();
	if (!row) {
		return { error: "Sequence not found" };
	}

	await workerEnv.DB.prepare("DELETE FROM sequences WHERE id = ?").bind(id).run();
	return { success: true };
}

export async function enrollInSequenceAction(
	sequenceId: string,
	data: { personId: string; fromAddress: string; variables?: Record<string, string> },
) {
	await requireSession();
	const parsed = enrollSchema.safeParse(data);
	if (!parsed.success) {
		return { error: parsed.error.issues[0]?.message ?? "Invalid enrollment parameters" };
	}

	const workerEnv = env as unknown as Env;
	const seq = await workerEnv.DB.prepare("SELECT id FROM sequences WHERE id = ? LIMIT 1").bind(sequenceId).first();
	if (!seq) {
		return { error: "Sequence not found" };
	}

	const person = await workerEnv.DB.prepare("SELECT id FROM people WHERE id = ? LIMIT 1")
		.bind(parsed.data.personId)
		.first();
	if (!person) {
		return { error: "Person not found" };
	}

	const id = generateId();
	await workerEnv.DB.prepare(
		`INSERT INTO sequence_enrollments (id, sequence_id, person_id, from_address, variables, current_step, status, enrolled_at)
     VALUES (?, ?, ?, ?, ?, 0, 'active', ?)
     ON CONFLICT (sequence_id, person_id) DO NOTHING`,
	)
		.bind(
			id,
			sequenceId,
			parsed.data.personId,
			parsed.data.fromAddress,
			JSON.stringify(parsed.data.variables ?? {}),
			new Date().toISOString(),
		)
		.run();

	return { success: true, enrollmentId: id };
}
