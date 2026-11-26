"use server";

import { env } from "cloudflare:workers";
import { z } from "zod";
import { DOMAIN_STEPS, domainCreateSchema, type DomainHealth } from "@/lib/core";
import { makeDb } from "@/worker/inbox/db";
import { getSendingSubdomain } from "@/worker/inbox/services/cloudflare";
import {
	checkDomainHealth,
	checkDomainRecords,
	enableReceiving,
	fixDomainRecords,
	invalidateDomainCaches,
	previewDomain,
	removeDomain,
	runDomainStep,
	sendDomainTestEmail,
} from "@/worker/inbox/services/domains";
import { writeAudit } from "@/worker/inbox/lib/audit";
import { requireAdmin } from "./auth";
import type { Env } from "@/worker/inbox/env";

/** Read-only look at the zone, and the plan for enabling the domain. Writes nothing. */
export async function previewDomainAction(input: { name: string; zoneName?: string }) {
	await requireAdmin();
	return previewDomain(env as unknown as Env, domainCreateSchema.parse(input));
}

const workerDb = () => (env as unknown as Env).DB;

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

export async function getDomainRecordsAction(id: string) {
	await requireAdmin();
	return checkDomainRecords(env as unknown as Env, id);
}

/** Writes the DNS records that are missing; see fixDomainRecords. */
export async function fixDomainRecordsAction(id: string) {
	await requireAdmin();
	return fixDomainRecords(env as unknown as Env, id);
}

/** Sends this domain's incoming mail to the inbox, replacing the zone's current catch-all. */
export async function enableReceivingAction(id: string) {
	const session = await requireAdmin();
	const result = await enableReceiving(env as unknown as Env, id);
	if (result.ok)
		await writeAudit(workerDb(), {
			actorId: session.userId,
			action: "domain.enable_receiving",
			targetType: "domain",
			targetId: id,
		});
	return result;
}

/** Sends a test message from the domain to the signed-in admin. */
export async function sendDomainTestEmailAction(id: string) {
	const session = await requireAdmin();
	return sendDomainTestEmail(env as unknown as Env, id, session.email);
}

const removeSchema = z.object({ deleteSending: z.boolean(), stopRouting: z.boolean() });

export async function removeDomainAction(id: string, options: z.input<typeof removeSchema>) {
	const session = await requireAdmin();
	const result = await removeDomain(env as unknown as Env, id, removeSchema.parse(options));
	if (result.ok) {
		await writeAudit(workerDb(), {
			actorId: session.userId,
			action: "domain.remove",
			targetType: "domain",
			targetId: id,
			detail: result.cleaned.join("; ") || "EmailFlare only",
		});
	}
	return result;
}
