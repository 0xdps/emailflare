// Domain onboarding and health, shared by the Hono API and the Next.js server actions.
// One implementation so the two entry points cannot drift apart.

import {
	DOMAIN_STEPS,
	buildPlan,
	classifyMx,
	checkRecord,
	deriveReceiving,
	deriveSending,
	emailBelongsToDomain,
	generateId,
	receivingRecommended,
	type DomainFacts,
	type DomainHealth,
	type DomainPlan,
	type DomainStep,
	type RecordCheck,
	type StepResult,
} from "@/lib/core";
import { deleteDomainCascade, makeDb } from "../db.ts";
import { inboxWorkerName, type Env } from "../env.ts";
import {
	CloudflareApiError,
	createSendingSubdomain,
	deleteSendingSubdomain,
	disableCatchAll,
	enableEmailRouting,
	sendEmail,
	getCatchAllRule,
	getSendingSubdomain,
	getSubdomainDnsRecords,
	getZoneByHostname,
	listDnsRecords,
	listSendingSubdomains,
	setCatchAllToWorker,
	upsertDnsRecords,
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

interface DomainInput {
	name: string;
	zoneName?: string;
}

const NO_ZONE = (name: string) =>
	`No active Cloudflare zone found for "${name}". Add the domain to this Cloudflare account, or use a name the token can read.`;

function failure(step: DomainStep, error: unknown): StepResult {
	if (error instanceof CloudflareApiError) {
		return isPermissionError(error)
			? {
					step,
					status: "failed",
					message: PERMISSION_MESSAGE,
					httpStatus: 422,
					cfCode: error.code,
					cfPath: error.path,
				}
			: {
					step,
					status: "failed",
					message: error.message,
					httpStatus: 502,
					cfCode: error.code,
					cfPath: error.path,
				};
	}
	throw error;
}

// ── Preflight (read-only) ─────────────────────────────────────────────────────

const normalizeTxt = (value: string) => value.replace(/^"|"$/g, "").trim();

/**
 * Looks at what the zone already has so the reader can see what enabling will change.
 * Nothing is written. Anything Cloudflare will not tell us becomes "unknown" rather than an error.
 */
export async function previewDomain(
	env: Env,
	input: DomainInput,
): Promise<{ ok: true; facts: DomainFacts; plan: DomainPlan } | { ok: false; error: string }> {
	const token = env.CF_API_TOKEN;
	if (!token) return { ok: false, error: "CF_API_TOKEN is not configured." };

	const { name, zoneName } = input;
	let zone: CFZone | null;
	try {
		zone = await resolveZone(name, zoneName, token);
	} catch (error) {
		if (error instanceof CloudflareApiError) {
			return { ok: false, error: isPermissionError(error) ? PERMISSION_MESSAGE : error.message };
		}
		throw error;
	}
	if (!zone) return { ok: false, error: NO_ZONE(name) };

	const { domains } = makeDb(env.DB);
	const registered = !!(await domains.findOne({ where: { name } }));
	const workerName = inboxWorkerName(env);

	const [subdomains, mxRecords, rule, dmarc] = await Promise.all([
		listSendingSubdomains(zone.id, token).catch(() => null),
		listDnsRecords(zone.id, token, { type: "MX", name: zone.name }).catch(() => null),
		getCatchAllRule(zone.id, token).catch(() => null),
		listDnsRecords(zone.id, token, { type: "TXT", name: `_dmarc.${zone.name}` }).catch(() => null),
	]);

	const existing = subdomains?.find((s) => s.name === name) ?? null;
	let sendingRecords: DomainFacts["sendingRecords"] = null;
	if (existing) {
		try {
			const expected = await getSubdomainDnsRecords(zone.id, existing.tag, token);
			const present = await Promise.all(
				expected.map(async (record) => {
					const found = await listDnsRecords(zone.id, token, { type: record.type, name: record.name });
					return found.some((f) => normalizeTxt(f.content) === normalizeTxt(record.content));
				}),
			);
			sendingRecords = {
				present: present.filter(Boolean).length,
				missing: present.filter((ok) => !ok).length,
			};
		} catch {
			sendingRecords = null;
		}
	}

	const mxHosts = (mxRecords ?? []).map((r) => r.content);
	const receiving = deriveReceiving(rule, workerName);
	const facts: DomainFacts = {
		zoneName: zone.name,
		sendingName: name,
		registered,
		sendingSubdomain: existing ? "exists" : "new",
		sendingRecords,
		mx: { state: mxRecords === null ? "unknown" : classifyMx(mxHosts), hosts: mxHosts },
		catchAll: {
			state:
				receiving.state === "ready"
					? "ours"
					: receiving.state === "elsewhere"
						? "elsewhere"
						: receiving.state === "off"
							? "off"
							: rule === null
								? "unknown"
								: "none",
			target: receiving.target,
		},
		dmarc: dmarc === null ? "unknown" : dmarc.some((r) => /^"?v=DMARC1/i.test(r.content)) ? "present" : "absent",
	};
	return { ok: true, facts, plan: buildPlan(facts, { receiving: receivingRecommended(facts) }) };
}

// ── Staged apply ──────────────────────────────────────────────────────────────

/**
 * Runs one stage of enabling a domain. Every stage is safe to repeat, so a failed stage can be
 * retried on its own and an abandoned run can be resumed by running the stages again.
 */
export async function runDomainStep(
	env: Env,
	input: DomainInput & { step: DomainStep; receiving: boolean; dnsStatus?: "written" | "manual" },
): Promise<StepResult> {
	const { step } = input;
	const token = env.CF_API_TOKEN;
	if (!token) return { step, status: "failed", message: "CF_API_TOKEN is not configured.", httpStatus: 422 };

	const { name, zoneName } = input;
	const { domains } = makeDb(env.DB);

	if (step === "routing" && !input.receiving) {
		return {
			step,
			status: "skipped",
			message: "Receiving was left off. Mail routing is unchanged.",
			routing: "pending",
		};
	}

	if (step === "sending" && (await domains.findOne({ where: { name } }))) {
		return { step, status: "failed", message: `Domain "${name}" is already registered`, httpStatus: 409 };
	}

	let zone: CFZone | null;
	try {
		zone = await resolveZone(name, zoneName, token);
	} catch (error) {
		return failure(step, error);
	}
	if (!zone) return { step, status: "failed", message: NO_ZONE(name), httpStatus: 422 };

	try {
		if (step === "sending") {
			const existing = (await listSendingSubdomains(zone.id, token)).find((s) => s.name === name);
			if (existing)
				return { step, status: "done", message: `${name} already exists in Cloudflare Email Sending.` };
			await createSendingSubdomain(zone.id, name, token);
			return { step, status: "done", message: `Created ${name} in Cloudflare Email Sending.` };
		}

		if (step === "dns") {
			const sub = (await listSendingSubdomains(zone.id, token)).find((s) => s.name === name);
			if (!sub)
				return {
					step,
					status: "failed",
					message: "The sending domain does not exist yet. Run the first step again.",
				};
			const records = await getSubdomainDnsRecords(zone.id, sub.tag, token);
			if (records.length === 0)
				return { step, status: "done", dnsStatus: "written", message: "No DNS records are needed." };
			const write = await upsertDnsRecords(zone.id, records, token);
			if (write.failed.length === 0) {
				return {
					step,
					status: "done",
					dnsStatus: "written",
					message: `Published ${records.length} DNS records.`,
				};
			}
			return {
				step,
				status: "warning",
				dnsStatus: "manual",
				records: records.map((r) => ({
					type: r.type,
					name: r.name,
					content: r.content,
					ttl: r.ttl,
					priority: r.priority,
				})),
				message: `${write.failed.length} of ${records.length} records could not be written (${write.failed[0].error}). Add them in Cloudflare DNS, then re-check the domain.`,
			};
		}

		if (step === "routing") {
			await enableEmailRouting(zone.id, token);
			await setCatchAllToWorker(zone.id, inboxWorkerName(env), token);
			return {
				step,
				status: "done",
				routing: "ready",
				message: "Email Routing is on and the catch-all points at this inbox.",
			};
		}

		// save
		const sub = (await listSendingSubdomains(zone.id, token)).find((s) => s.name === name);
		if (!sub)
			return {
				step,
				status: "failed",
				message: "The sending domain does not exist yet. Run the first step again.",
			};
		if (await domains.findOne({ where: { name } })) {
			return { step, status: "done", message: "Already saved." };
		}
		const rule = input.receiving ? await getCatchAllRule(zone.id, token).catch(() => null) : null;
		await domains.insert({
			id: generateId(),
			name,
			cf_zone_id: zone.id,
			cf_subdomain_id: sub.tag,
			dkim_selector: sub.dkim_selector ?? null,
			return_path_domain: sub.return_path_domain ?? null,
			verified: sub.enabled ? 1 : 0,
			dns_status: input.dnsStatus ?? (sub.enabled ? "written" : "manual"),
			routing_status: deriveReceiving(rule, inboxWorkerName(env)).state === "ready" ? "ready" : "pending",
			created_at: new Date().toISOString(),
		});
		await invalidateDomainCaches(env);
		return { step, status: "done", message: `${name} is saved. Cloudflare confirms sending once DNS propagates.` };
	} catch (error) {
		return failure(step, error);
	}
}

export type EnableDomainResult =
	| {
			ok: true;
			domain: Awaited<ReturnType<ReturnType<typeof makeDb>["domains"]["insert"]>>;
			dns: { status: "written" | "manual"; records: StepResult["records"] };
			routing: "ready" | "pending";
	  }
	| { ok: false; status: 409 | 422 | 502; error: string; cfCode?: number | null; cfPath?: string | null };

/** The whole flow in one call, for the public API. Receiving is on unless the caller opts out. */
export async function enableDomain(
	env: Env,
	input: DomainInput & { receiving?: boolean },
): Promise<EnableDomainResult> {
	const receiving = input.receiving ?? true;
	const results: StepResult[] = [];
	let dnsStatus: "written" | "manual" | undefined;

	for (const step of DOMAIN_STEPS) {
		// Routing is independent of DNS, so a routing problem does not stop the domain from being saved.
		const result = await runDomainStep(env, { ...input, step, receiving, dnsStatus });
		results.push(result);
		if (result.dnsStatus) dnsStatus = result.dnsStatus;
		if (result.status === "failed" && step !== "routing") {
			return {
				ok: false,
				status: result.httpStatus ?? 502,
				error: result.message,
				cfCode: result.cfCode,
				cfPath: result.cfPath,
			};
		}
	}

	const domain = await makeDb(env.DB).domains.findOne({ where: { name: input.name } });
	if (!domain) return { ok: false, status: 502, error: "The domain could not be saved." };
	const dns = results.find((r) => r.step === "dns");
	const routing = results.find((r) => r.step === "routing");
	return {
		ok: true,
		domain,
		dns: { status: dns?.dnsStatus ?? "written", records: dns?.status === "warning" ? dns.records : [] },
		routing: routing?.routing ?? "pending",
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

	const inboxes = await env.DB.prepare("SELECT email FROM inboxes").all<{ email: string }>();
	const mailboxCount = (domainName: string) =>
		(inboxes.results ?? []).filter((i) => emailBelongsToDomain(i.email, domainName)).length;

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
				mailboxes: mailboxCount(row.name),
				checkedAt,
			};
		}),
	);

	await env.RATE_LIMIT_KV?.put(HEALTH_CACHE_KEY, JSON.stringify(health), { expirationTtl: HEALTH_TTL }).catch(
		() => undefined,
	);
	return health;
}

// ── Domain detail ─────────────────────────────────────────────────────────────

async function loadDomain(env: Env, id: string) {
	const domain = await makeDb(env.DB).domains.findOne({ where: { id } });
	if (!domain) throw new Error("Domain not found");
	return domain;
}

/** Compares every DNS record Cloudflare expects for sending with what the zone really holds. */
export async function checkDomainRecords(
	env: Env,
	id: string,
): Promise<{ records: RecordCheck[]; sendingEnabled: boolean | null }> {
	const domain = await loadDomain(env, id);
	const token = env.CF_API_TOKEN;
	if (!domain.cf_subdomain_id) return { records: [], sendingEnabled: null };

	const [expected, sub] = await Promise.all([
		getSubdomainDnsRecords(domain.cf_zone_id, domain.cf_subdomain_id, token),
		getSendingSubdomain(domain.cf_zone_id, domain.cf_subdomain_id, token).catch(() => null),
	]);
	const records = await Promise.all(
		expected.map(async (record) => {
			const found = await listDnsRecords(domain.cf_zone_id, token, { type: record.type, name: record.name });
			return checkRecord(
				{ type: record.type, name: record.name, content: record.content, ttl: record.ttl },
				found,
			);
		}),
	);
	return { records, sendingEnabled: sub ? sub.enabled : null };
}

/**
 * Writes the records that are missing. Records that exist with another value are left alone:
 * overwriting them could break mail the reader set up on purpose, so they are reported instead.
 */
export async function fixDomainRecords(env: Env, id: string) {
	const domain = await loadDomain(env, id);
	const token = env.CF_API_TOKEN;
	const before = await checkDomainRecords(env, id);
	const missing = before.records.filter((r) => r.status === "missing");
	if (missing.length > 0) {
		await upsertDnsRecords(
			domain.cf_zone_id,
			missing.map((r) => ({ type: r.type, name: r.name, content: r.content, ttl: r.ttl })),
			token,
		);
	}
	const after = await checkDomainRecords(env, id);
	if (after.sendingEnabled !== null) {
		await makeDb(env.DB).domains.update({
			where: { id },
			set: { verified: after.sendingEnabled ? 1 : 0, ...(after.sendingEnabled ? { dns_status: "written" } : {}) },
		});
	}
	await invalidateDomainCaches(env);
	return { ...after, fixed: missing.length };
}

/**
 * Points a mailbox's domain at this inbox. A catch-all that already sends mail somewhere else
 * is never replaced from here; that needs the explicit choice made on the domain page.
 */
export async function configureInboxRouting(env: Env, email: string): Promise<{ configured: boolean; error?: string }> {
	try {
		const token = env.CF_API_TOKEN;
		const domain = email.split("@")[1];
		const zone = await getZoneByHostname(domain, token);
		if (!zone) return { configured: false, error: `No active Cloudflare zone found for "${domain}"` };

		const rule = await getCatchAllRule(zone.id, token).catch(() => null);
		const receiving = deriveReceiving(rule, inboxWorkerName(env));
		if (receiving.state === "ready") return { configured: true };
		if (receiving.state === "elsewhere") {
			return {
				configured: false,
				error: `Mail for ${domain} is routed to ${receiving.target ?? "another destination"}. Turn on receiving for the domain to route it here.`,
			};
		}
		await enableEmailRouting(zone.id, token);
		await setCatchAllToWorker(zone.id, inboxWorkerName(env), token);
		return { configured: true };
	} catch (err) {
		return { configured: false, error: err instanceof Error ? err.message : "Email Routing configuration failed" };
	}
}

/** The explicit choice: send this domain's incoming mail to the inbox, replacing the current catch-all. */
export async function enableReceiving(env: Env, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
	const domain = await loadDomain(env, id);
	try {
		await enableEmailRouting(domain.cf_zone_id, env.CF_API_TOKEN);
		await setCatchAllToWorker(domain.cf_zone_id, inboxWorkerName(env), env.CF_API_TOKEN);
		await makeDb(env.DB).domains.update({ where: { id }, set: { routing_status: "ready" } });
		await env.DB.prepare(
			"UPDATE inboxes SET routing_configured = 1, routing_error = NULL WHERE lower(email) LIKE ?",
		)
			.bind(`%@${domain.name.toLowerCase()}`)
			.run();
		await invalidateDomainCaches(env);
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : "Could not turn on receiving" };
	}
}

export async function sendDomainTestEmail(
	env: Env,
	id: string,
	to: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const domain = await loadDomain(env, id);
	try {
		await sendEmail(
			{
				from: { address: `test@${domain.name}`, name: "EmailFlare" },
				to,
				subject: `EmailFlare test from ${domain.name}`,
				text: `This message confirms that ${domain.name} can send mail through EmailFlare.\n\nIf you received it, sending works. Reply to it to check that receiving works too.`,
			},
			env.CF_API_TOKEN,
			env.CF_ACCOUNT_ID,
		);
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : "The test email could not be sent" };
	}
}

export interface RemoveOptions {
	/** Also delete the sending domain, and the DNS records Cloudflare created for it. */
	deleteSending: boolean;
	/** Also stop the zone's catch-all from delivering to this inbox. Refused if another domain uses the zone. */
	stopRouting: boolean;
}

/**
 * Removes a domain from EmailFlare, and from Cloudflare when asked. Cloudflare is cleaned up first
 * so a failure leaves the domain listed and the removal can be retried.
 */
export async function removeDomain(
	env: Env,
	id: string,
	opts: RemoveOptions,
): Promise<{ ok: true; cleaned: string[] } | { ok: false; error: string }> {
	const domain = await loadDomain(env, id);
	const token = env.CF_API_TOKEN;
	const cleaned: string[] = [];
	const missingIsFine = (err: unknown) => err instanceof CloudflareApiError && err.status === 404;

	try {
		if (opts.stopRouting) {
			const sharing = await env.DB.prepare("SELECT COUNT(*) AS n FROM domains WHERE cf_zone_id = ? AND id <> ?")
				.bind(domain.cf_zone_id, id)
				.first<{ n: number }>();
			if ((sharing?.n ?? 0) > 0) {
				return { ok: false, error: "Another domain uses this zone's mail routing, so it was left unchanged." };
			}
			const rule = await getCatchAllRule(domain.cf_zone_id, token).catch(() => null);
			if (deriveReceiving(rule, inboxWorkerName(env)).state === "ready") {
				await disableCatchAll(domain.cf_zone_id, token);
				cleaned.push("Stopped routing mail to this inbox");
			}
		}
		if (opts.deleteSending && domain.cf_subdomain_id) {
			try {
				await deleteSendingSubdomain(domain.cf_zone_id, domain.cf_subdomain_id, token);
				cleaned.push("Deleted the sending domain and its DNS records in Cloudflare");
			} catch (err) {
				if (!missingIsFine(err)) throw err;
			}
		}
	} catch (err) {
		return {
			ok: false,
			error: `${err instanceof Error ? err.message : "Cloudflare cleanup failed"}. The domain is still listed so you can retry.`,
		};
	}

	await deleteDomainCascade(env.DB, id);
	await invalidateDomainCaches(env);
	return { ok: true, cleaned };
}
