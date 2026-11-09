"use server";

import { env } from "cloudflare:workers";
import { getCloudflareTokenStatus } from "@/worker/inbox/services/cloudflare";
import { requireAdmin } from "./auth";
import { createDomainAction } from "./domains";
import { createInboxAction } from "./inboxes";
import type { Env } from "@/worker/inbox/env";

export interface Readiness {
	token: { active: boolean; message: string };
	domains: number;
	mailboxes: number;
}

export async function getReadiness(): Promise<Readiness> {
	await requireAdmin();
	const workerEnv = env as unknown as Env;
	const token = await getCloudflareTokenStatus(workerEnv.CF_API_TOKEN, workerEnv.CF_ACCOUNT_ID).catch(
		(error: unknown) => ({
			active: false,
			message:
				error instanceof Error
					? error.message
					: "Token check failed. Required: Zone Read, DNS Write, Email Sending, Email Routing.",
		}),
	);
	const domains = await workerEnv.DB.prepare("SELECT COUNT(*) AS n FROM domains").first<{ n: number }>();
	const mailboxes = await workerEnv.DB.prepare("SELECT COUNT(*) AS n FROM inboxes").first<{ n: number }>();
	return {
		token: { active: !!token.active, message: token.message },
		domains: domains?.n ?? 0,
		mailboxes: mailboxes?.n ?? 0,
	};
}

export async function createFirstMailbox(input: { localPart: string; domain: string; displayName: string }) {
	const session = await requireAdmin();
	const localPart = input.localPart.trim().toLowerCase();
	if (!/^[a-z0-9._+-]+$/.test(localPart)) {
		throw new Error("Mailbox name can only use letters, numbers, and . _ + -");
	}
	const created = await createInboxAction({
		email: `${localPart}@${input.domain}`,
		display_name: input.displayName.trim() || localPart,
		mode: "thread",
	});
	await (env as unknown as Env).DB.prepare("INSERT OR IGNORE INTO inbox_members (inbox_id, user_id) VALUES (?, ?)")
		.bind(created.id, session.userId)
		.run();
	return created;
}

export async function enableSetupDomain(zoneName: string, sendingName: string) {
	await requireAdmin();
	return createDomainAction({ name: sendingName, zoneName });
}
