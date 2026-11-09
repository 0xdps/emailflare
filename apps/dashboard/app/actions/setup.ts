"use server";

import { env } from "cloudflare:workers";
import { getCloudflareTokenStatus } from "@/worker/inbox/services/cloudflare";
import { requireAdmin } from "./auth";
import { createDomainAction } from "./domains";
import type { Env } from "@/worker/inbox/env";

export interface Readiness {
	token: { active: boolean; message: string };
	domains: number;
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
	return {
		token: { active: !!token.active, message: token.message },
		domains: domains?.n ?? 0,
	};
}

export async function enableSetupDomain(zoneName: string, sendingName: string) {
	await requireAdmin();
	return createDomainAction({ name: sendingName, zoneName });
}
