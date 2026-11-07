"use server";

import { env } from "cloudflare:workers";
import { z } from "zod";
import { generateId } from "@emailflare/email-core";
import { makeDb } from "@/worker/inbox/db";
import type { Env } from "@/worker/inbox/env";
import { requireApi } from "./auth";

const addSchema = z.object({
	email: z.string().email(),
	reason: z.enum(["hard_bounce", "soft_bounce", "complaint", "manual", "unsubscribed"]).default("manual"),
	domain_id: z.string().optional(),
});

export async function createSuppressionAction(data: {
	email: string;
	reason?: "hard_bounce" | "soft_bounce" | "complaint" | "manual" | "unsubscribed";
	domain_id?: string;
}) {
	await requireApi();
	const parsed = addSchema.safeParse(data);
	if (!parsed.success) {
		return { error: parsed.error.issues[0]?.message ?? "Invalid suppression parameters" };
	}

	const workerEnv = env as unknown as Env;
	const { db } = makeDb(workerEnv.DB);
	const now = new Date().toISOString();

	try {
		await db.run(
			`INSERT INTO suppressions (id, email, reason, domain_id, email_log_id, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
			[generateId(), parsed.data.email.toLowerCase(), parsed.data.reason, parsed.data.domain_id ?? null, now],
		);
		return { success: true };
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Unknown error";
		if (msg.includes("UNIQUE")) {
			return { error: "Address already suppressed" };
		}
		return { error: msg };
	}
}

export async function deleteSuppressionAction(id: string) {
	await requireApi();
	const workerEnv = env as unknown as Env;
	const { db } = makeDb(workerEnv.DB);

	try {
		await db.run("DELETE FROM suppressions WHERE id = ?", [id]);
		return { success: true };
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Failed to delete suppression";
		return { error: msg };
	}
}
