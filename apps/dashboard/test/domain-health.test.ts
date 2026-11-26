import assert from "node:assert/strict";
import test from "node:test";
import { deriveReceiving, deriveSending, healthHint } from "../lib/core/domain-health.ts";
import { checkDomainHealth } from "../worker/inbox/services/domains.ts";
import { fakeDB, fakeKV } from "./helpers.ts";

test("sending that Cloudflare could not report is unknown, not pending", () => {
	assert.equal(deriveSending(true), "ready");
	assert.equal(deriveSending(false), "pending");
	assert.equal(deriveSending(null), "unknown");
});

test("receiving is ready only when the catch-all targets this Worker", () => {
	const to = (value: string[]) => ({ enabled: true, actions: [{ type: "worker", value }] });
	assert.equal(deriveReceiving(to(["emailflare"]), "emailflare").state, "ready");
	assert.deepEqual(deriveReceiving(to(["other"]), "emailflare"), { state: "elsewhere", target: "worker: other" });
	assert.deepEqual(
		deriveReceiving({ enabled: true, actions: [{ type: "forward", value: ["a@x.test"] }] }, "emailflare"),
		{
			state: "elsewhere",
			target: "forward: a@x.test",
		},
	);
	assert.equal(deriveReceiving({ enabled: false, actions: [] }, "emailflare").state, "off");
	assert.equal(deriveReceiving(null, "emailflare").state, "unknown");
});

test("hints explain what to do and stay quiet when everything is fine", () => {
	assert.match(
		healthHint({ sending: "ready", receiving: "elsewhere", receivingTarget: "forward: a@x.test" })!,
		/forward: a@x\.test/,
	);
	assert.match(healthHint({ sending: "ready", receiving: "off", receivingTarget: null })!, /no active catch-all/);
	assert.match(healthHint({ sending: "pending", receiving: "ready", receivingTarget: null })!, /DNS records/);
	assert.equal(healthHint({ sending: "ready", receiving: "ready", receivingTarget: null }), null);
});

// ── checkDomainHealth against a stubbed Cloudflare ────────────────────────────

type Row = Record<string, unknown>;

function healthEnv(rows: Row[]) {
	const updates: Array<{ id: unknown; set: string }> = [];
	const db = fakeDB((sql, args) => {
		if (sql.includes("COUNT(i.id)")) return { all: rows.map((r) => ({ id: r.id, n: r.id === "d1" ? 2 : 0 })) };
		if (sql.toUpperCase().startsWith("SELECT")) return { all: rows };
		if (sql.toUpperCase().startsWith("UPDATE")) updates.push({ id: args[args.length - 1], set: sql });
	});
	const env = { DB: db, RATE_LIMIT_KV: fakeKV(), CF_API_TOKEN: "t", INBOX_WORKER_NAME: "emailflare" };
	return { env: env as never, updates };
}

function stubCloudflare(responses: Record<string, unknown>) {
	const original = globalThis.fetch;
	globalThis.fetch = (async (url: string) => {
		const hit = Object.entries(responses).find(([part]) => String(url).includes(part));
		return Response.json(
			hit ? { success: true, result: hit[1] } : { success: false, errors: [{ code: 1000, message: "boom" }] },
		);
	}) as typeof fetch;
	return () => void (globalThis.fetch = original);
}

test("health reflects Cloudflare, corrects stale rows and counts mailboxes", async () => {
	const restore = stubCloudflare({
		"/subdomains/sub1": { tag: "sub1", name: "mail.a.test", enabled: true },
		"rules/catch_all": { enabled: true, actions: [{ type: "worker", value: ["emailflare"] }] },
	});
	try {
		const { env, updates } = healthEnv([
			{
				id: "d1",
				name: "mail.a.test",
				cf_zone_id: "z1",
				cf_subdomain_id: "sub1",
				verified: 1,
				dns_status: "manual",
				routing_status: "pending",
			},
		]);
		const [health] = await checkDomainHealth(env, { fresh: true });
		assert.equal(health.sending, "ready");
		assert.equal(health.receiving, "ready");
		assert.equal(health.mailboxes, 2);
		assert.equal(updates.length, 1); // stale dns_status and routing_status fixed in one update
	} finally {
		restore();
	}
});

test("when Cloudflare cannot answer the state is unknown and nothing is rewritten", async () => {
	const restore = stubCloudflare({});
	try {
		const { env, updates } = healthEnv([
			{
				id: "d1",
				name: "mail.a.test",
				cf_zone_id: "z1",
				cf_subdomain_id: "sub1",
				verified: 1,
				dns_status: "written",
				routing_status: "ready",
			},
		]);
		const [health] = await checkDomainHealth(env, { fresh: true });
		assert.equal(health.sending, "unknown");
		assert.equal(health.receiving, "unknown");
		assert.equal(updates.length, 0);
	} finally {
		restore();
	}
});

test("health is cached, and fresh bypasses the cache", async () => {
	let calls = 0;
	const original = globalThis.fetch;
	globalThis.fetch = (async () => {
		calls++;
		return Response.json({
			success: true,
			result: { enabled: true, actions: [{ type: "worker", value: ["emailflare"] }] },
		});
	}) as typeof fetch;
	try {
		const { env } = healthEnv([
			{
				id: "d1",
				name: "mail.a.test",
				cf_zone_id: "z1",
				cf_subdomain_id: "sub1",
				verified: 1,
				dns_status: "written",
				routing_status: "ready",
			},
		]);
		await checkDomainHealth(env);
		const first = calls;
		await checkDomainHealth(env);
		assert.equal(calls, first);
		await checkDomainHealth(env, { fresh: true });
		assert.ok(calls > first);
	} finally {
		globalThis.fetch = original;
	}
});
