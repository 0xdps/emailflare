"use server";

import { env } from "cloudflare:workers";
import { domainCreateSchema, type DomainHealth } from "@/lib/core";
import { makeDb, deleteDomainCascade } from "@/worker/inbox/db";
import { getSendingSubdomain } from "@/worker/inbox/services/cloudflare";
import { checkDomainHealth, enableDomain, invalidateDomainCaches } from "@/worker/inbox/services/domains";
import { requireAdmin } from "./auth";
import { inboxWorkerName, type Env } from "@/worker/inbox/env";

export async function createDomainAction(input: { name: string; zoneName?: string }) {
	await requireAdmin();
	const result = await enableDomain(env as unknown as Env, domainCreateSchema.parse(input));
	if (!result.ok) throw new Error(result.error);
	return { ...result.domain, dns: result.dns, routing: result.routing };
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
