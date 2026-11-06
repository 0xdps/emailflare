"use server";

import { env } from "cloudflare:workers";
import type { Env } from "@/worker/inbox/env";
import { requireSession } from "./auth";

export async function markReadAction(personId: string) {
	await requireSession();
	const workerEnv = env as unknown as Env;
	await workerEnv.DB.prepare("UPDATE inbox_emails SET is_read = 1 WHERE person_id = ?").bind(personId).run();
	return { success: true };
}
