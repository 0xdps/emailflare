import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { makeDb, deleteDomainCascade } from "../db.ts";
import {
	CloudflareApiError,
	createSendingSubdomain,
	listSendingSubdomains,
	listAllZones,
	getSubdomainDnsRecords,
	getSendingSubdomain,
	getCatchAllRule,
	upsertDnsRecords,
	enableEmailRouting,
	setCatchAllToWorker,
	type CFDnsRecord,
	type CFSubdomain,
	type CFZone,
} from "../services/cloudflare.ts";
import { inboxWorkerName, type HonoEnv } from "../env.ts";
import { domainCreateSchema, generateId } from "@/lib/core";

const app = new Hono<HonoEnv>();

const CATALOG_ZONE_CAP = 25;

export interface DomainCatalogEntry {
	zoneName: string;
	enabled: boolean;
	domainId: string | null;
	sendingName: string | null;
	sending: "ready" | "pending" | "off";
	routing: "ready" | "pending" | "unknown";
	dns: "written" | "manual" | "unknown";
}

function sendingState(sub: CFSubdomain | undefined): "ready" | "pending" | "off" {
	if (!sub) return "off";
	return sub.enabled ? "ready" : "pending";
}

function routingState(
	rule: { enabled?: boolean; actions?: Array<{ type: string; value?: string[] }> } | null,
	workerName: string,
): "ready" | "pending" | "unknown" {
	if (!rule) return "unknown";
	const worker = rule.actions?.find((action) => action.type === "worker");
	if (rule.enabled && worker?.value?.includes(workerName)) return "ready";
	return "pending";
}

async function resolveZone(name: string, zoneName: string | undefined, token: string): Promise<CFZone | null> {
	const zones = await listAllZones(token);
	const host = name.toLowerCase();
	const root = (zoneName ?? name).toLowerCase();
	return (
		zones.find(
			(zone) =>
				zone.name.toLowerCase() === root &&
				(host === zone.name.toLowerCase() || host.endsWith(`.${zone.name.toLowerCase()}`)),
		) ?? null
	);
}

function permissionMessage(error: CloudflareApiError): string | null {
	if (error.code === 10000 || error.code === 9109 || error.status === 401 || error.status === 403) {
		return "Cloudflare token is missing a required permission. Enable needs Zone Read, DNS Write, Email Sending, and Email Routing.";
	}
	return null;
}

// GET /api/domains/catalog — zones the token can see, joined with EmailFlare state.
// Zone IDs stay on the server.
app.get("/catalog", async (c) => {
	const token = c.env.CF_API_TOKEN;
	if (!token) return c.json({ error: "CF_API_TOKEN is not configured." }, 422);

	let zones: CFZone[];
	try {
		zones = await listAllZones(token);
	} catch (error) {
		if (error instanceof CloudflareApiError) {
			return c.json(
				{ error: permissionMessage(error) ?? error.message },
				error.status === 401 || error.status === 403 ? 422 : 502,
			);
		}
		throw error;
	}

	const capped = zones.slice(0, CATALOG_ZONE_CAP);
	const { domains } = makeDb(c.env.DB);
	const stored = await domains.find({ orderBy: [{ column: "created_at", direction: "desc" }] });

	const entries: DomainCatalogEntry[] = await Promise.all(
		capped.map(async (zone) => {
			const row = stored.find(
				(domain) =>
					domain.cf_zone_id === zone.id || domain.name === zone.name || domain.name.endsWith(`.${zone.name}`),
			);
			let sending: DomainCatalogEntry["sending"] = "off";
			let sendingName: string | null = row?.name ?? null;
			let routing: DomainCatalogEntry["routing"] = "unknown";

			try {
				const subs = await listSendingSubdomains(zone.id, token);
				const match = subs.find((sub) => sub.name === row?.name) ?? subs.find((sub) => sub.enabled) ?? subs[0];
				sending = sendingState(match);
				sendingName = match?.name ?? sendingName;
			} catch {
				sending = row?.verified ? "ready" : "off";
			}

			try {
				const rule = await getCatchAllRule(zone.id, token);
				routing = routingState(rule, inboxWorkerName(c.env));
			} catch {
				routing =
					row?.routing_status === "ready" || row?.routing_status === "pending"
						? row.routing_status
						: "unknown";
			}

			return {
				zoneName: zone.name,
				enabled: !!row,
				domainId: row?.id ?? null,
				sendingName,
				sending,
				routing,
				dns: row?.dns_status === "written" || row?.dns_status === "manual" ? row.dns_status : "unknown",
			};
		}),
	);

	return c.json({
		zones: entries,
		truncated: zones.length > capped.length,
		total: zones.length,
	});
});

// GET /api/domains
app.get("/", async (c) => {
	const { domains } = makeDb(c.env.DB);
	const rows = await domains.find({ orderBy: [{ column: "created_at", direction: "desc" }] });
	return c.json(rows);
});

// GET /api/domains/:id
app.get("/:id", async (c) => {
	const { domains } = makeDb(c.env.DB);
	const domain = await domains.findOne({ where: { id: c.req.param("id") } });
	if (!domain) return c.json({ error: "Domain not found" }, 404);
	return c.json(domain);
});

// POST /api/domains — enable a zone the token can already see. The browser sends
// the zone name, never a zone ID.
app.post("/", zValidator("json", domainCreateSchema), async (c) => {
	const { name, zoneName } = c.req.valid("json");
	const { domains } = makeDb(c.env.DB);
	const token = c.env.CF_API_TOKEN;
	if (!token) return c.json({ error: "CF_API_TOKEN is not configured." }, 422);

	const existing = await domains.findOne({ where: { name } });
	if (existing) return c.json({ error: `Domain "${name}" is already registered` }, 409);

	const zone = await resolveZone(name, zoneName, token);
	if (!zone) {
		return c.json(
			{
				error: `No active Cloudflare zone found for "${name}". Add the domain to this Cloudflare account, or use a name the token can read.`,
			},
			422,
		);
	}

	let cfResult: CFSubdomain;
	try {
		const allSubdomains = await listSendingSubdomains(zone.id, token);
		cfResult = allSubdomains.find((s) => s.name === name) ?? (await createSendingSubdomain(zone.id, name, token));
	} catch (error) {
		if (error instanceof CloudflareApiError) {
			const denied = permissionMessage(error);
			if (denied) return c.json({ error: denied, cfCode: error.code, cfPath: error.path }, 422);
			return c.json({ error: error.message, cfCode: error.code, cfPath: error.path }, 502);
		}
		throw error;
	}

	let dnsStatus: "written" | "manual" = "written";
	let dnsRecords: CFDnsRecord[] = [];
	try {
		dnsRecords = await getSubdomainDnsRecords(zone.id, cfResult.tag, token);
		if (dnsRecords.length > 0) {
			const write = await upsertDnsRecords(zone.id, dnsRecords, token);
			dnsStatus = write.failed.length === 0 ? "written" : "manual";
		}
	} catch (error) {
		dnsStatus = "manual";
		if (!(error instanceof CloudflareApiError)) throw error;
	}

	let routingStatus: "ready" | "pending" = "pending";
	try {
		await enableEmailRouting(zone.id, token);
		await setCatchAllToWorker(zone.id, inboxWorkerName(c.env), token);
		routingStatus = "ready";
	} catch {
		routingStatus = "pending";
	}

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

	return c.json(
		{
			...row,
			dns: { status: dnsStatus, records: dnsStatus === "manual" ? dnsRecords : [] },
			routing: routingStatus,
		},
		201,
	);
});

// GET /api/domains/:id/dns
app.get("/:id/dns", async (c) => {
	const { domains } = makeDb(c.env.DB);
	const domain = await domains.findOne({ where: { id: c.req.param("id") } });
	if (!domain) return c.json({ error: "Domain not found" }, 404);
	if (!domain.cf_subdomain_id) return c.json({ error: "Cloudflare subdomain not yet provisioned" }, 400);

	const records = await getSubdomainDnsRecords(domain.cf_zone_id, domain.cf_subdomain_id, c.env.CF_API_TOKEN);
	return c.json(records);
});

// POST /api/domains/:id/verify
app.post("/:id/verify", async (c) => {
	const { domains } = makeDb(c.env.DB);
	const domain = await domains.findOne({ where: { id: c.req.param("id") } });
	if (!domain) return c.json({ error: "Domain not found" }, 404);
	if (!domain.cf_subdomain_id) return c.json({ error: "Cloudflare subdomain not provisioned" }, 400);

	const cfData = await getSendingSubdomain(domain.cf_zone_id, domain.cf_subdomain_id, c.env.CF_API_TOKEN);

	await domains.update({
		where: { id: domain.id },
		set: {
			verified: cfData.enabled ? 1 : 0,
			dkim_selector: cfData.dkim_selector ?? null,
			return_path_domain: cfData.return_path_domain ?? null,
		},
	});

	return c.json({ verified: cfData.enabled });
});

// DELETE /api/domains/:id
app.delete("/:id", async (c) => {
	const { domains } = makeDb(c.env.DB);
	const domain = await domains.findOne({ where: { id: c.req.param("id") } });
	if (!domain) return c.json({ error: "Domain not found" }, 404);

	await deleteDomainCascade(c.env.DB, domain.id);
	return c.json({ deleted: true });
});

export default app;
