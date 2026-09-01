import { Hono } from "hono";
import { generateId } from "@emailflare/email-core";
import { getCloudflareTokenStatus, listAllZones, listSendingSubdomains } from "../services/cloudflare.ts";
import { makeDb } from "../db.ts";
import type { HonoEnv } from "../env.ts";

const app = new Hono<HonoEnv>();

// GET /api/cloudflare/status
app.get("/status", async (c) => {
	const status = await getCloudflareTokenStatus(c.env.CF_API_TOKEN, c.env.CF_ACCOUNT_ID);
	return c.json(status);
});

// POST /api/cloudflare/backfill-domains
// Scans every active CF zone for Email Sending Subdomains and imports any that
// are not yet registered in emailflare. Email delivery history cannot be
// recovered because Cloudflare does not expose outbound email logs via API.
app.post("/backfill-domains", async (c) => {
	const { domains } = makeDb(c.env.DB);
	const zones = await listAllZones(c.env.CF_API_TOKEN);

	const results: Array<{ name: string; status: "imported" | "existing" }> = [];

	for (const zone of zones) {
		let subdomains;
		try {
			subdomains = await listSendingSubdomains(zone.id, c.env.CF_API_TOKEN);
		} catch {
			// Zone has no email sending configured — skip silently.
			continue;
		}

		for (const sub of subdomains) {
			const existing = await domains.findOne({ where: { name: sub.name } });
			if (existing) {
				results.push({ name: sub.name, status: "existing" });
				continue;
			}

			await domains.insert({
				id: generateId(),
				name: sub.name,
				cf_zone_id: zone.id,
				cf_subdomain_id: sub.tag,
				dkim_selector: sub.dkim_selector ?? null,
				return_path_domain: sub.return_path_domain ?? null,
				verified: sub.enabled ? 1 : 0,
				created_at: new Date().toISOString(),
			});

			results.push({ name: sub.name, status: "imported" });
		}
	}

	const imported = results.filter((r) => r.status === "imported").length;
	const existing = results.filter((r) => r.status === "existing").length;
	return c.json({ ok: true, imported, existing, domains: results });
});

export default app;
