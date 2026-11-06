"use server";

import { env } from "cloudflare:workers";
import { generateId, listCreateSchema } from "@emailflare/email-core";
import { makeDb } from "@/worker/inbox/db";
import type { Env } from "@/worker/inbox/env";
import { requireSession } from "./auth";

export async function createListAction(data: { name: string; slug?: string; description?: string; domainId?: string }) {
	await requireSession();
	const parsed = listCreateSchema.safeParse(data);
	if (!parsed.success) {
		return { error: parsed.error.issues[0]?.message ?? "Invalid list parameters" };
	}

	const workerEnv = env as unknown as Env;
	const { lists } = makeDb(workerEnv.DB);

	const row = await lists.insert({
		id: generateId(),
		name: parsed.data.name,
		slug: parsed.data.slug ?? null,
		description: parsed.data.description ?? null,
		domain_id: parsed.data.domainId ?? null,
		created_at: new Date().toISOString(),
	});

	return { data: row };
}

export async function deleteListAction(id: string) {
	await requireSession();
	const workerEnv = env as unknown as Env;
	const { lists, suppressions } = makeDb(workerEnv.DB);

	const row = await lists.findOne({ where: { id } });
	if (!row) {
		return { error: "List not found" };
	}

	await suppressions.delete({ where: { list_id: id } });
	await lists.delete({ where: { id } });

	return { success: true };
}
