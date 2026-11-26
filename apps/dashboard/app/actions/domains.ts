"use server";

import { env } from "cloudflare:workers";
import { z } from "zod";
import { DOMAIN_STEPS, domainCreateSchema, type DomainHealth } from "@/lib/core";
import { makeDb, deleteDomainCascade } from "@/worker/inbox/db";
import { getSendingSubdomain } from "@/worker/inbox/services/cloudflare";
import {
	checkDomainHealth,
	invalidateDomainCaches,
	previewDomain,
	runDomainStep,
} from "@/worker/inbox/services/domains";
import { requireAdmin } from "./auth";
import { inboxWorkerName, type Env } from "@/worker/inbox/env";

/** Read-only look at the zone, and the plan for enabling the domain. Writes nothing. */
export async function previewDomainAction(input: { name: string; zoneName?: string }) {
	await requireAdmin();
	return previewDomain(env as unknown as Env, domainCreateSchema.parse(input));
}

const stepSchema = domainCreateSchema.extend({
	step: z.enum(DOMAIN_STEPS),
	receiving: z.boolean(),
	dnsStatus: z.enum(["written", "manual"]).optional(),
});

/** Runs one stage of enabling a domain. Safe to repeat; see runDomainStep. */
export async function runDomainStepAction(input: z.input<typeof stepSchema>) {
	await requireAdmin();
	return runDomainStep(env as unknown as Env, stepSchema.parse(input));
}

/** Live sending and receiving state for every domain; see checkDomainHealth. */
export async function getDomainHealthAction(opts: { fresh?: boolean } = {}): Promise<DomainHealth[]> {
	await requireAdmin();
	return checkDomainHealth(env as unknown as Env, opts);
}

export async function verifyDomainAction(id: string): Promise<{ verified: boolean }> {
	await requireAdmin();
	const workerEnv = env as unknown as Env;
	const { domains } = makeDb(workerEnv.DB);

	const domain = await domains.findOne({ where: { id } });
	if (!domain) throw new Error("Domain not found");
	if (!domain.cf_subdomain_id) throw new Error("Cloudflare subdomain not provisioned");

	const cfData = await getSendingSubdomain(domain.cf_zone_id, domain.cf_subdomain_id, workerEnv.CF_API_TOKEN);

	await domains.update({
		where: { id: domain.id },
		set: {
			verified: cfData.enabled ? 1 : 0,
			dkim_selector: cfData.dkim_selector ?? null,
			return_path_domain: cfData.return_path_domain ?? null,
			...(cfData.enabled ? { dns_status: "written" } : {}),
		},
	});

	await invalidateDomainCaches(workerEnv);
	return { verified: cfData.enabled };
}

export async function deleteDomainAction(id: string): Promise<{ deleted: boolean }> {
	await requireAdmin();
	const workerEnv = env as unknown as Env;
	const { domains } = makeDb(workerEnv.DB);

	const domain = await domains.findOne({ where: { id } });
	if (!domain) throw new Error("Domain not found");

	await deleteDomainCascade(workerEnv.DB, domain.id);
	await invalidateDomainCaches(workerEnv);
	return { deleted: true };
}
