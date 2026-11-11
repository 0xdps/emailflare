import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { makeDb, deleteDomainCascade } from "../db.ts";
import {
	CloudflareApiError,
	createSendingSubdomain,
	listSendingSubdomains,
	getZoneByHostname,
	buildDomainCatalog,
	getSubdomainDnsRecords,
	getSendingSubdomain,
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

export interface DomainCatalogEntry {
	zoneName: string;
	enabled: boolean;
	domainId: string | null;
	sendingName: string | null;
	sending: "ready" | "pending" | "off";
	routing: "ready" | "pending" | "unknown";
	dns: "written" | "manual" | "unknown";
}

async function resolveZone(name: string, zoneName: string | undefined, token: string): Promise<CFZone | null> {
	const host = name.toLowerCase();
	const root = (zoneName ?? name).toLowerCase();
	if (host !== root && !host.endsWith(`.${root}`)) return null;
	return getZoneByHostname(root, token);
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

	const { domains } = makeDb(c.env.DB);
	const stored = await domains.find({ orderBy: [{ column: "created_at", direction: "desc" }] });
	// Setup only needs names. Sending and routing status are two Cloudflare calls
	// per zone, so skip them unless the caller asks for the full catalog.
	try {
		const catalog = await buildDomainCatalog(
			token,
			stored.map((row) => ({
				id: row.id,
				name: row.name,
				cf_zone_id: row.cf_zone_id,
				verified: row.verified,
				routing_status: row.routing_status ?? null,
				dns_status: row.dns_status ?? null,
			})),
			inboxWorkerName(c.env),
			c.req.query("view") === "full",
		);
		return c.json(catalog);
	} catch (error) {
		if (error instanceof CloudflareApiError) {
			return c.json(
				{ error: permissionMessage(error) ?? error.message },
				error.status === 401 || error.status === 403 ? 422 : 502,
			);
		}
		throw error;
	}
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
				await setCatchAllToWorker(zone.id, inboxWorkerName(c.env), token);
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
