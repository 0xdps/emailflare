import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { makeDb, deleteDomainCascade } from "../db.ts";
import { checkDomainHealth, enableDomain, invalidateDomainCaches, PERMISSION_MESSAGE } from "../services/domains.ts";
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

function permissionMessage(error: CloudflareApiError): string | null {
	if (error.code === 10000 || error.code === 9109 || error.status === 401 || error.status === 403) {
		return PERMISSION_MESSAGE;
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

// GET /api/domains/health — live sending and receiving state per domain
app.get("/health", async (c) => c.json(await checkDomainHealth(c.env, { fresh: c.req.query("fresh") === "1" })));

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
	const result = await enableDomain(c.env, c.req.valid("json"));
	if (!result.ok) {
		const { status, ...body } = result;
		return c.json(body, status);
	}
	return c.json({ ...result.domain, dns: result.dns, routing: result.routing }, 201);
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
			...(cfData.enabled ? { dns_status: "written" } : {}),
		},
	});

	await invalidateDomainCaches(c.env);
	return c.json({ verified: cfData.enabled });
});

// DELETE /api/domains/:id
app.delete("/:id", async (c) => {
	const { domains } = makeDb(c.env.DB);
	const domain = await domains.findOne({ where: { id: c.req.param("id") } });
	if (!domain) return c.json({ error: "Domain not found" }, 404);

	await deleteDomainCascade(c.env.DB, domain.id);
	await invalidateDomainCaches(c.env);
	return c.json({ deleted: true });
});

export default app;
