import assert from "node:assert/strict";
import test from "node:test";
import {
	ALERT_AFTER_CHECKS,
	evaluateHealthChange,
	issuesOf,
	type DomainHealth,
	type MonitorState,
} from "../lib/core/domain-health.ts";
import { monitorDomains } from "../worker/inbox/services/domain-monitor.ts";
import { fakeDB, fakeKV } from "./helpers.ts";

const health = (over: Partial<DomainHealth> = {}): DomainHealth => ({
	id: "d1",
	sending: "ready",
	receiving: "ready",
	receivingTarget: null,
	mailboxes: 2,
	checkedAt: "",
	...over,
});

test("receiving only counts as an issue for a domain that has mailboxes", () => {
	assert.deepEqual(issuesOf(health()), []);
	assert.equal(issuesOf(health({ receiving: "off" })).length, 1);
	assert.equal(issuesOf(health({ receiving: "elsewhere" })).length, 1);
	assert.deepEqual(
		issuesOf(health({ receiving: "off", mailboxes: 0 })),
		[],
		"a sending-only domain is working as intended",
	);
	assert.equal(issuesOf(health({ sending: "pending", mailboxes: 0 })).length, 1);
});

test("an issue is reported only after it persists, once, and recovery is reported once", () => {
	const broken = [health({ sending: "pending" })];
	let state: Record<string, MonitorState> = {};
	const events: string[] = [];
	for (let i = 0; i < ALERT_AFTER_CHECKS + 2; i++) {
		const result = evaluateHealthChange(state, broken);
		state = result.state;
		events.push(...result.events.map((e) => `${i}:${e.type}`));
	}
	assert.deepEqual(events, [`${ALERT_AFTER_CHECKS - 1}:degraded`]);

	const fixed = evaluateHealthChange(state, [health()]);
	assert.deepEqual(
		fixed.events.map((e) => e.type),
		["recovered"],
	);
	assert.deepEqual(evaluateHealthChange(fixed.state, [health()]).events, []);
});

test("a blip that fixes itself before the threshold never alerts", () => {
	let result = evaluateHealthChange({}, [health({ sending: "pending" })]);
	result = evaluateHealthChange(result.state, [health()]);
	assert.deepEqual(result.events, []);
	assert.equal(result.state.d1.bad, 0);
});

test("when Cloudflare cannot answer, nothing changes: no alert and no false recovery", () => {
	const alerted = { d1: { bad: 5, alerted: true } };
	const unknown = evaluateHealthChange(alerted, [health({ sending: "unknown", receiving: "unknown" })]);
	assert.deepEqual(unknown.events, []);
	assert.deepEqual(unknown.state, alerted);
});

// ── monitorDomains ────────────────────────────────────────────────────────────

function monitorEnv(domainHealthy: boolean) {
	const audits: unknown[][] = [];
	const hooks: string[] = [];
	const db = fakeDB((sql, args) => {
		if (sql.startsWith("INSERT INTO audit_log")) audits.push(args);
		if (sql.includes("FROM webhooks"))
			return { all: [{ id: "w", url: "https://hook.test/x", secret: "s", events: '["*"]' }] };
		if (sql.includes("FROM inboxes")) return { all: [{ email: "a@a.test" }] };
		if (sql.includes("FROM domains")) {
			return {
				all: [
					{
						id: "d1",
						name: "a.test",
						cf_zone_id: "z",
						cf_subdomain_id: "s",
						verified: 1,
						dns_status: "written",
						routing_status: "ready",
					},
				],
			};
		}
		return {};
	});
	const originalFetch = globalThis.fetch;
	globalThis.fetch = (async (input: string) => {
		const url = String(input);
		if (url.startsWith("https://hook.test")) {
			hooks.push(url);
			return new Response("ok");
		}
		if (url.includes("/subdomains/s")) return Response.json({ success: true, result: { enabled: domainHealthy } });
		return Response.json({
			success: true,
			result: { enabled: true, actions: [{ type: "worker", value: ["emailflare"] }] },
		});
	}) as typeof fetch;
	const kv = fakeKV();
	return {
		audits,
		hooks,
		kv,
		env: { DB: db, RATE_LIMIT_KV: kv, CF_API_TOKEN: "t", INBOX_WORKER_NAME: "emailflare" } as never,
		restore: () => void (globalThis.fetch = originalFetch),
	};
}

test("the monitor throttles itself, alerts after repeated failures, and tells webhooks and the audit log", async () => {
	const m = monitorEnv(false);
	try {
		const t0 = 1_000_000_000_000;
		assert.equal(await monitorDomains(m.env, t0), 0, "first sighting is not an alert");
		assert.equal(await monitorDomains(m.env, t0 + 60_000), 0, "runs again only after the interval");
		const raised = await monitorDomains(m.env, t0 + 31 * 60_000);
		assert.equal(raised, 1);
		assert.equal(m.audits.length, 1);
		assert.equal(m.audits[0][2], "domain.degraded");
		assert.deepEqual(m.hooks, ["https://hook.test/x"]);
	} finally {
		m.restore();
	}
});

test("the monitor does nothing without a Cloudflare token", async () => {
	const m = monitorEnv(false);
	try {
		assert.equal(await monitorDomains({ ...(m.env as object), CF_API_TOKEN: "" } as never), 0);
	} finally {
		m.restore();
	}
});
