"use server";

import { env } from "cloudflare:workers";
import type { Env } from "@/worker/inbox/env";
import { requireInbox } from "./auth";

export async function markReadAction(personId: string) {
	const session = await requireInbox();
	const workerEnv = env as unknown as Env;
	if (session.userType === "admin") {
		await workerEnv.DB.prepare("UPDATE inbox_emails SET is_read = 1 WHERE person_id = ?").bind(personId).run();
	} else {
		await workerEnv.DB.prepare(
			`
			UPDATE inbox_emails
			SET is_read = 1
			WHERE person_id = ?
			  AND inbox_address IN (
			    SELECT i.email
			    FROM inboxes i
			    JOIN inbox_members im ON i.id = im.inbox_id
			    WHERE im.user_id = ?
			  )
		`,
		)
			.bind(personId, session.userId)
			.run();
	}
	return { success: true };
}

export async function markThreadReadAction(threadId: string) {
	const session = await requireInbox();
	const workerEnv = env as unknown as Env;
	if (session.userType === "admin") {
		await workerEnv.DB.prepare("UPDATE inbox_emails SET is_read = 1 WHERE thread_id = ?").bind(threadId).run();
	} else {
		await workerEnv.DB.prepare(
			`
			UPDATE inbox_emails
			SET is_read = 1
			WHERE thread_id = ?
			  AND inbox_address IN (
			    SELECT i.email
			    FROM inboxes i
			    JOIN inbox_members im ON i.id = im.inbox_id
			    WHERE im.user_id = ?
			  )
		`,
		)
			.bind(threadId, session.userId)
			.run();
	}
	return { success: true };
}
