import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { generateId } from "@emailflare/email-core";
import { makeDb, deleteDomainCascade } from "../db.js";
import {
	CloudflareApiError,
	createSendingSubdomain,
	listSendingSubdomains,
	getSubdomainDnsRecords,
	getSendingSubdomain,
	getZoneByHostname,
} from "../services/cloudflare.js";
import { env } from "../env.js";
import type { HonoEnv } from "../env.js";

const app = new Hono<HonoEnv>();

app.get("/", async (c) => {
	const { domains } = makeDb();
	const rows = await domains.find({ orderBy: [{ column: "created_at", direction: "desc" }] });
	return c.json(rows);
});

app.get("/:id", async (c) => {
	const { domains } = makeDb();
	const domain = await domains.findOne({ where: { id: c.req.param("id") } });
	if (!domain) return c.json({ error: "Domain not found" }, 404);
	return c.json(domain);
});

const createSchema = z.object({
	name: z.string().min(3),
	cfZoneId: z.string().optional(),
});

app.post("/", zValidator("json", createSchema), async (c) => {
	const { name, cfZoneId } = c.req.valid("json");
	const { domains } = makeDb();
	const token = env.CF_API_TOKEN;

	const existing = await domains.findOne({ where: { name } });
	if (existing) return c.json({ error: `Domain "${name}" is already registered` }, 409);

	let zoneId = cfZoneId;
	if (!zoneId) {
		const zone = await getZoneByHostname(name, token);
		if (!zone) {
			return c.json(
				{
					error: `No active Cloudflare zone found for "${name}". Make sure the root domain is added to your Cloudflare account.`,
				},
				422,
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
				return c.json(
					{
						error: "Cloudflare token is missing permission for Email Sending Subdomains.",
						cfCode: error.code,
						cfPath: error.path,
					},
					422,
				);
			}
			return c.json({ error: error.message, cfCode: error.code, cfPath: error.path }, 502);
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

	return c.json(row, 201);
});

app.get("/:id/dns", async (c) => {
	const { domains } = makeDb();
	const domain = await domains.findOne({ where: { id: c.req.param("id") } });
	if (!domain) return c.json({ error: "Domain not found" }, 404);
	if (!domain.cf_subdomain_id) return c.json({ error: "Cloudflare subdomain not yet provisioned" }, 400);

	const records = await getSubdomainDnsRecords(domain.cf_zone_id, domain.cf_subdomain_id, env.CF_API_TOKEN);
	return c.json(records);
});

app.post("/:id/verify", async (c) => {
	const { domains } = makeDb();
	const domain = await domains.findOne({ where: { id: c.req.param("id") } });
	if (!domain) return c.json({ error: "Domain not found" }, 404);
	if (!domain.cf_subdomain_id) return c.json({ error: "Cloudflare subdomain not provisioned" }, 400);

	const cfData = await getSendingSubdomain(domain.cf_zone_id, domain.cf_subdomain_id, env.CF_API_TOKEN);
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

app.delete("/:id", async (c) => {
	const { domains } = makeDb();
	const domain = await domains.findOne({ where: { id: c.req.param("id") } });
	if (!domain) return c.json({ error: "Domain not found" }, 404);
	await deleteDomainCascade(domain.id);
	return c.json({ deleted: true });
});

export default app;
