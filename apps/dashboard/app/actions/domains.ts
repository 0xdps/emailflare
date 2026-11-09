"use server";

import { env } from "cloudflare:workers";
import { generateId, domainCreateSchema } from "@/lib/core";
import { makeDb, deleteDomainCascade } from "@/worker/inbox/db";
import {
	CloudflareApiError,
	createSendingSubdomain,
	listSendingSubdomains,
	getZoneByHostname,
	getSubdomainDnsRecords,
	getSendingSubdomain,
	upsertDnsRecords,
	enableEmailRouting,
	setCatchAllToWorker,
	type CFDnsRecord,
	type CFZone,
} from "@/worker/inbox/services/cloudflare";
import { requireAdmin } from "./auth";
import { inboxWorkerName, type Env } from "@/worker/inbox/env";

async function resolveZone(name: string, zoneName: string | undefined, token: string): Promise<CFZone | null> {
	const host = name.toLowerCase();
	const root = (zoneName ?? name).toLowerCase();
	if (host !== root && !host.endsWith(`.${root}`)) return null;
	return getZoneByHostname(root, token);
}

export async function createDomainAction(input: { name: string; zoneName?: string }) {
	await requireAdmin();
	const { name, zoneName } = domainCreateSchema.parse(input);
	const workerEnv = env as unknown as Env;
	const { domains } = makeDb(workerEnv.DB);
	const token = workerEnv.CF_API_TOKEN;
	if (!token) throw new Error("CF_API_TOKEN is not configured.");

	const existing = await domains.findOne({ where: { name } });
	if (existing) throw new Error(`Domain "${name}" is already registered`);

	const zone = await resolveZone(name, zoneName, token);
	if (!zone) {
		throw new Error(
			`No active Cloudflare zone found for "${name}". Add the domain to this Cloudflare account, or use a name the token can read.`,
		);
	}

	let cfResult;
	try {
		const allSubdomains = await listSendingSubdomains(zone.id, token);
		cfResult = allSubdomains.find((s) => s.name === name) ?? (await createSendingSubdomain(zone.id, name, token));
	} catch (error) {
		if (error instanceof CloudflareApiError) {
			if (error.code === 10000 || error.code === 9109 || error.status === 401 || error.status === 403) {
				throw new Error(
					"Cloudflare token is missing a required permission. Enable needs Zone Read, DNS Write, Email Sending, and Email Routing.",
				);
			}
			throw new Error(error.message);
		}
		throw error;
	}

	const [dnsOutcome, routingStatus] = await Promise.all([
		(async (): Promise<{ status: "written" | "manual"; records: CFDnsRecord[] }> => {
			try {
				const records = await getSubdomainDnsRecords(zone.id, cfResult.tag, token);
				if (records.length === 0) return { status: "written", records };
				const write = await upsertDnsRecords(zone.id, records, token);
				return { status: write.failed.length === 0 ? "written" : "manual", records };
			} catch (error) {
				if (!(error instanceof CloudflareApiError)) throw error;
				return { status: "manual", records: [] };
			}
		})(),
		(async (): Promise<"ready" | "pending"> => {
			try {
				await enableEmailRouting(zone.id, token);
				await setCatchAllToWorker(zone.id, inboxWorkerName(workerEnv), token);
				return "ready";
			} catch {
				return "pending";
			}
		})(),
	]);
	const dnsStatus = dnsOutcome.status;
	const dnsRecords = dnsOutcome.records;

	const row = await domains.insert({
		id: generateId(),
		name,
		cf_zone_id: zone.id,
		cf_subdomain_id: cfResult.tag,
		dkim_selector: cfResult.dkim_selector ?? null,
		return_path_domain: cfResult.return_path_domain ?? null,
		verified: cfResult.enabled ? 1 : 0,
		dns_status: dnsStatus,
		routing_status: routingStatus,
		created_at: new Date().toISOString(),
	});

	return {
		...row,
		dns: { status: dnsStatus, records: dnsStatus === "manual" ? dnsRecords : [] },
		routing: routingStatus,
	};
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
