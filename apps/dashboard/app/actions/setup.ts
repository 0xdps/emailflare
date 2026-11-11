"use server";

import { env } from "cloudflare:workers";
import { getCloudflareTokenStatus } from "@/worker/inbox/services/cloudflare";
import { requireAdmin } from "./auth";
import { createDomainAction } from "./domains";
import type { Env } from "@/worker/inbox/env";

export interface Readiness {
	token: {
		active: boolean;
		message: string;
		accountName: string | null;
		accountId: string | null;
	};
	domains: number;
	readyDomain: string | null;
	adminEmail: string | null;
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
	const [domains, ready, admin] = await Promise.all([
		workerEnv.DB.prepare("SELECT COUNT(*) AS n FROM domains").first<{ n: number }>(),
		workerEnv.DB.prepare("SELECT name FROM domains WHERE verified = 1 ORDER BY created_at ASC LIMIT 1").first<{
			name: string;
		}>(),
		workerEnv.DB.prepare(
			"SELECT email FROM users WHERE user_type = 'admin' ORDER BY created_at ASC LIMIT 1",
		).first<{
			email: string;
		}>(),
	]);
	return {
		token: {
			active: !!token.active,
			message: token.message,
			accountName: "accountName" in token ? token.accountName : null,
			accountId: "accountId" in token ? token.accountId : null,
		},
		domains: domains?.n ?? 0,
		readyDomain: ready?.name ?? null,
		adminEmail: admin?.email ?? null,
	};
}

export async function enableSetupDomain(zoneName: string, sendingName: string) {
	await requireAdmin();
	return createDomainAction({ name: sendingName, zoneName });
}
