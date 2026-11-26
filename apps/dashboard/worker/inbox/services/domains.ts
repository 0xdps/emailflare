// Domain onboarding and health, shared by the Hono API and the Next.js server actions.
// One implementation so the two entry points cannot drift apart.

import { deriveReceiving, deriveSending, generateId, type DomainHealth } from "@/lib/core";
import { makeDb } from "../db.ts";
import { inboxWorkerName, type Env } from "../env.ts";
import {
	CloudflareApiError,
	createSendingSubdomain,
	enableEmailRouting,
	getCatchAllRule,
	getSendingSubdomain,
	getSubdomainDnsRecords,
	getZoneByHostname,
	listSendingSubdomains,
	setCatchAllToWorker,
	upsertDnsRecords,
	type CFDnsRecord,
	type CFSubdomain,
	type CFZone,
} from "./cloudflare.ts";

export const CATALOG_CACHE_KEY = "cache:catalog:zones";
export const HEALTH_CACHE_KEY = "cache:domain-health";
const HEALTH_TTL = 60;

export const PERMISSION_MESSAGE =
	"Cloudflare token is missing a required permission. Enable needs Zone Read, DNS Write, Email Sending, and Email Routing.";

function isPermissionError(error: CloudflareApiError): boolean {
	return error.code === 10000 || error.code === 9109 || error.status === 401 || error.status === 403;
}

export type EnableDomainResult =
	| {
			ok: true;
			domain: Awaited<ReturnType<ReturnType<typeof makeDb>["domains"]["insert"]>>;
			dns: { status: "written" | "manual"; records: CFDnsRecord[] };
			routing: "ready" | "pending";
	  }
	| { ok: false; status: 409 | 422 | 502; error: string; cfCode?: number | null; cfPath?: string | null };

async function resolveZone(name: string, zoneName: string | undefined, token: string): Promise<CFZone | null> {
	const host = name.toLowerCase();
	const root = (zoneName ?? name).toLowerCase();
	if (host !== root && !host.endsWith(`.${root}`)) return null;
	return getZoneByHostname(root, token);
}

/** Forget cached catalog and health so the next page load reflects a change. */
export async function invalidateDomainCaches(env: Pick<Env, "RATE_LIMIT_KV">): Promise<void> {
	await Promise.all([
		env.RATE_LIMIT_KV?.delete(CATALOG_CACHE_KEY),
		env.RATE_LIMIT_KV?.delete(HEALTH_CACHE_KEY),
	]).catch(() => undefined);
}

export async function enableDomain(env: Env, input: { name: string; zoneName?: string }): Promise<EnableDomainResult> {
	const token = env.CF_API_TOKEN;
	if (!token) return { ok: false, status: 422, error: "CF_API_TOKEN is not configured." };

	const { name, zoneName } = input;
	const { domains } = makeDb(env.DB);

	if (await domains.findOne({ where: { name } })) {
		return { ok: false, status: 409, error: `Domain "${name}" is already registered` };
	}

	const zone = await resolveZone(name, zoneName, token);
	if (!zone) {
		return {
			ok: false,
			status: 422,
			error: `No active Cloudflare zone found for "${name}". Add the domain to this Cloudflare account, or use a name the token can read.`,
		};
	}

	let sub: CFSubdomain;
	try {
		const existing = await listSendingSubdomains(zone.id, token);
		sub = existing.find((s) => s.name === name) ?? (await createSendingSubdomain(zone.id, name, token));
	} catch (error) {
		if (!(error instanceof CloudflareApiError)) throw error;
		return isPermissionError(error)
			? { ok: false, status: 422, error: PERMISSION_MESSAGE, cfCode: error.code, cfPath: error.path }
			: { ok: false, status: 502, error: error.message, cfCode: error.code, cfPath: error.path };
	}

	const [dns, routing] = await Promise.all([
		(async (): Promise<{ status: "written" | "manual"; records: CFDnsRecord[] }> => {
			try {
				const records = await getSubdomainDnsRecords(zone.id, sub.tag, token);
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
				await setCatchAllToWorker(zone.id, inboxWorkerName(env), token);
				return "ready";
			} catch {
				return "pending";
			}
		})(),
	]);

	const domain = await domains.insert({
		id: generateId(),
		name,
		cf_zone_id: zone.id,
		cf_subdomain_id: sub.tag,
		dkim_selector: sub.dkim_selector ?? null,
		return_path_domain: sub.return_path_domain ?? null,
		verified: sub.enabled ? 1 : 0,
		dns_status: dns.status,
		routing_status: routing,
		created_at: new Date().toISOString(),
	});

	await invalidateDomainCaches(env);
	return {
		ok: true,
		domain,
		dns: { status: dns.status, records: dns.status === "manual" ? dns.records : [] },
		routing,
	};
}

/**
 * Asks Cloudflare what each domain can do today. Results are cached for a minute.
 *
 * A stored row can disagree with Cloudflare (DNS written by hand, routing changed in the
 * dashboard). Where Cloudflare answered, the row is corrected, so the stored state stops
 * lying. Where it could not answer, the row is left alone and the state is "unknown".
 */
export async function checkDomainHealth(env: Env, opts: { fresh?: boolean } = {}): Promise<DomainHealth[]> {
	if (!opts.fresh) {
		const cached = await env.RATE_LIMIT_KV?.get(HEALTH_CACHE_KEY, "json").catch(() => null);
		if (Array.isArray(cached)) return cached as DomainHealth[];
	}

	const token = env.CF_API_TOKEN;
	const { domains } = makeDb(env.DB);
	const rows = await domains.find();
	const workerName = inboxWorkerName(env);

	const counts = await env.DB.prepare(
		"SELECT d.id AS id, COUNT(i.id) AS n FROM domains d LEFT JOIN inboxes i ON lower(i.email) LIKE '%@' || lower(d.name) GROUP BY d.id",
	).all<{ id: string; n: number }>();
	const mailboxes = new Map((counts.results ?? []).map((r) => [r.id, r.n]));

	// Several domains can share a zone (apex and mail.), and the catch-all belongs to the zone.
	const rules = new Map<string, Promise<Awaited<ReturnType<typeof getCatchAllRule>> | null>>();
	const ruleFor = (zoneId: string) => {
		if (!rules.has(zoneId))
			rules.set(
				zoneId,
				getCatchAllRule(zoneId, token).catch(() => null),
			);
		return rules.get(zoneId)!;
	};

	const checkedAt = new Date().toISOString();
	const health = await Promise.all(
		rows.map(async (row): Promise<DomainHealth> => {
			const [enabled, rule] = token
				? await Promise.all([
						row.cf_subdomain_id
							? getSendingSubdomain(row.cf_zone_id, row.cf_subdomain_id, token)
									.then((s) => s.enabled)
									.catch(() => null)
							: Promise.resolve(null),
						ruleFor(row.cf_zone_id),
					])
				: [null, null];

			const sending = deriveSending(enabled);
			const receiving = deriveReceiving(rule, workerName);

			const patch: Record<string, unknown> = {};
			if (sending === "ready" && (!row.verified || row.dns_status !== "written")) {
				patch.verified = 1;
				patch.dns_status = "written";
			} else if (sending === "pending" && row.verified) {
				patch.verified = 0;
			}
			if (receiving.state === "ready" && row.routing_status !== "ready") patch.routing_status = "ready";
			else if ((receiving.state === "off" || receiving.state === "elsewhere") && row.routing_status === "ready") {
				patch.routing_status = "pending";
			}
			if (Object.keys(patch).length)
				await domains.update({ where: { id: row.id }, set: patch }).catch(() => undefined);

			return {
				id: row.id,
				sending,
				receiving: receiving.state,
				receivingTarget: receiving.target,
				mailboxes: mailboxes.get(row.id) ?? 0,
				checkedAt,
			};
		}),
	);

	await env.RATE_LIMIT_KV?.put(HEALTH_CACHE_KEY, JSON.stringify(health), { expirationTtl: HEALTH_TTL }).catch(
		() => undefined,
	);
	return health;
}
