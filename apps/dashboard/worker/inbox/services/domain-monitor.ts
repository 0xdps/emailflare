// Watches registered domains for drift (DNS removed, routing changed in Cloudflare) and tells
// webhooks and the audit log when one breaks or recovers. Runs from the cron trigger.

import { evaluateHealthChange, issuesOf, type DomainHealth, type MonitorState } from "@/lib/core";
import { makeDb } from "../db.ts";
import type { Env } from "../env.ts";
import { writeAudit } from "../lib/audit.ts";
import { dispatchWebhooks } from "../lib/webhooks.ts";
import { checkDomainHealth } from "./domains.ts";

const STATE_KEY = "monitor:domains";
const LAST_RUN_KEY = "monitor:domains:last";
const INTERVAL_MS = 30 * 60 * 1000;
const STATE_TTL = 60 * 60 * 24 * 30;

/** Returns how many alerts were raised. Cheap no-op between intervals, since the cron fires every 5 minutes. */
export async function monitorDomains(env: Env, now = Date.now()): Promise<number> {
	if (!env.CF_API_TOKEN) return 0;

	const last = Number(await env.RATE_LIMIT_KV.get(LAST_RUN_KEY));
	if (last && now - last < INTERVAL_MS) return 0;
	await env.RATE_LIMIT_KV.put(LAST_RUN_KEY, String(now), { expirationTtl: STATE_TTL });

	const health = await checkDomainHealth(env, { fresh: true });
	const previous = ((await env.RATE_LIMIT_KV.get(STATE_KEY, "json")) ?? {}) as Record<string, MonitorState>;
	const { state, events } = evaluateHealthChange(previous, health);
	await env.RATE_LIMIT_KV.put(STATE_KEY, JSON.stringify(state), { expirationTtl: STATE_TTL });
	if (events.length === 0) return 0;

	const names = new Map((await makeDb(env.DB).domains.find()).map((d) => [d.id, d.name]));
	const byId = new Map<string, DomainHealth>(health.map((h) => [h.id, h]));

	for (const event of events) {
		const name = names.get(event.domainId) ?? event.domainId;
		const issues = event.type === "degraded" ? event.issues : [];
		await writeAudit(env.DB, {
			action: event.type === "degraded" ? "domain.degraded" : "domain.recovered",
			targetType: "domain",
			targetId: event.domainId,
			detail: event.type === "degraded" ? `${name}: ${issues.join("; ")}` : `${name} is healthy again`,
		}).catch(() => undefined);
		await dispatchWebhooks(env, event.type === "degraded" ? "domain.degraded" : "domain.recovered", {
			domain: name,
			domainId: event.domainId,
			issues:
				event.type === "degraded"
					? issues
					: issuesOf(byId.get(event.domainId) ?? { sending: "ready", receiving: "ready", mailboxes: 0 }),
		}).catch(() => undefined);
	}
	return events.length;
}
