"use server";

import { env } from "cloudflare:workers";
import { generateId, domainCreateSchema } from "@emailflare/email-core";
import { makeDb, deleteDomainCascade } from "@/worker/inbox/db";
import {
	CloudflareApiError,
	createSendingSubdomain,
	listSendingSubdomains,
	getSendingSubdomain,
	getZoneByHostname,
} from "@/worker/inbox/services/cloudflare";
import { requireAdmin } from "./auth";
import type { Env } from "@/worker/inbox/env";

export async function createDomainAction(input: { name: string; cfZoneId?: string }) {
	await requireAdmin();
	const { name, cfZoneId } = domainCreateSchema.parse(input);
	const workerEnv = env as unknown as Env;
	const { domains } = makeDb(workerEnv.DB);
	const token = workerEnv.CF_API_TOKEN;

	const existing = await domains.findOne({ where: { name } });
	if (existing) throw new Error(`Domain "${name}" is already registered`);

	let zoneId = cfZoneId;
	if (!zoneId) {
		const zone = await getZoneByHostname(name, token);
		if (!zone) {
			throw new Error(
				`No active Cloudflare zone found for "${name}". Make sure the root domain is added to your Cloudflare account.`,
			);
		}
		zoneId = zone.id;
	}

	let cfResult;
	try {
		const allSubdomains = await listSendingSubdomains(zoneId, token);
		cfResult = allSubdomains.find((s) => s.name === name) ?? (await createSendingSubdomain(zoneId, name, token));
	} catch (error) {
		if (error instanceof CloudflareApiError) {
			if (error.code === 10000 || error.code === 9109 || error.status === 401 || error.status === 403) {
				throw new Error(
					"Cloudflare token is missing permission for Email Sending Subdomains. Required: Account: Email Security Edit; Zone: Email Routing Rules Edit; Zone: Zone Read; Zone: DNS Read/Write.",
				);
			}
			throw new Error(error.message);
		}
		throw error;
	}

	const row = await domains.insert({
		id: generateId(),
		name,
		cf_zone_id: zoneId,
		cf_subdomain_id: cfResult.tag,
		dkim_selector: cfResult.dkim_selector ?? null,
		return_path_domain: cfResult.return_path_domain ?? null,
		verified: cfResult.enabled ? 1 : 0,
		created_at: new Date().toISOString(),
	});

	return row;
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
		},
	});

	return { verified: cfData.enabled };
}

export async function deleteDomainAction(id: string): Promise<{ deleted: boolean }> {
	await requireAdmin();
	const workerEnv = env as unknown as Env;
	const { domains } = makeDb(workerEnv.DB);

	const domain = await domains.findOne({ where: { id } });
	if (!domain) throw new Error("Domain not found");

	await deleteDomainCascade(workerEnv.DB, domain.id);
	return { deleted: true };
}
