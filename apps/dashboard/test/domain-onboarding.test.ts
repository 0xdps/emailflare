import assert from "node:assert/strict";
import test from "node:test";
import { buildPlan, classifyMx, receivingRecommended, type DomainFacts } from "../lib/core/domain-plan.ts";
import {
	checkDomainRecords,
	configureInboxRouting,
	fixDomainRecords,
	previewDomain,
	removeDomain,
	runDomainStep,
} from "../worker/inbox/services/domains.ts";
import { fakeDB, fakeKV } from "./helpers.ts";

const facts = (over: Partial<DomainFacts> = {}): DomainFacts => ({
	zoneName: "a.test",
	sendingName: "mail.a.test",
	registered: false,
	sendingSubdomain: "new",
	sendingRecords: null,
	mx: { state: "none", hosts: [] },
	catchAll: { state: "none", target: null },
	dmarc: "present",
	...over,
});

// ── Plan ──────────────────────────────────────────────────────────────────────

test("MX hosts are classified so a Cloudflare-routed zone is not mistaken for another provider", () => {
	assert.equal(classifyMx([]), "none");
	assert.equal(classifyMx(["route1.mx.cloudflare.net", "route2.mx.cloudflare.net."]), "cloudflare");
	assert.equal(classifyMx(["route1.mx.cloudflare.net", "aspmx.l.google.com"]), "other");
});

test("receiving is not preselected when it would take mail from another provider", () => {
	assert.equal(receivingRecommended(facts()), true);
	assert.equal(receivingRecommended(facts({ mx: { state: "cloudflare", hosts: [] } })), true);
	assert.equal(receivingRecommended(facts({ mx: { state: "other", hosts: ["aspmx.l.google.com"] } })), false);
	assert.equal(
		receivingRecommended(facts({ catchAll: { state: "elsewhere", target: "forward: me@x.test" } })),
		false,
	);
	assert.equal(receivingRecommended(facts({ catchAll: { state: "ours", target: null } })), true);
});

test("a plan names what is added, kept and replaced, and warns about the risky parts", () => {
	const fresh = buildPlan(facts(), { receiving: true });
	assert.deepEqual(
		fresh.items.map((i) => [i.id, i.action]),
		[
			["sending", "add"],
			["dns", "add"],
			["routing", "add"],
		],
	);
	assert.deepEqual(fresh.warnings, []);

	const risky = buildPlan(
		facts({
			sendingSubdomain: "exists",
			sendingRecords: { present: 3, missing: 0 },
			mx: { state: "other", hosts: ["aspmx.l.google.com"] },
			catchAll: { state: "elsewhere", target: "forward: me@x.test" },
			dmarc: "absent",
		}),
		{ receiving: true },
	);
	assert.deepEqual(
		risky.items.map((i) => [i.id, i.action]),
		[
			["sending", "keep"],
			["dns", "keep"],
			["routing", "replace"],
			["dmarc", "info"],
		],
	);
	assert.equal(risky.warnings.length, 2);
	assert.match(risky.warnings.join(" "), /aspmx\.l\.google\.com/);
	assert.match(risky.warnings.join(" "), /forward: me@x\.test/);
});

test("turning receiving off skips routing and drops the receiving warnings", () => {
	const plan = buildPlan(facts({ mx: { state: "other", hosts: ["aspmx.l.google.com"] } }), { receiving: false });
	assert.equal(plan.items.find((i) => i.id === "routing")?.action, "skip");
	assert.deepEqual(plan.warnings, []);
});

test("an already registered domain blocks the plan", () => {
	assert.match(buildPlan(facts({ registered: true }), { receiving: true }).blocked ?? "", /already set up/);
});

// ── Service against a stubbed Cloudflare ──────────────────────────────────────

interface Call {
	method: string;
	url: string;
}

function cloudflare(opts: {
	subdomains?: Array<Record<string, unknown>>;
	dnsRecords?: Array<Record<string, unknown>>;
	zoneRecords?: Record<string, Array<Record<string, unknown>>>;
	catchAll?: Record<string, unknown> | "error";
	failDnsWrite?: boolean;
	failRouting?: boolean;
}) {
	const calls: Call[] = [];
	const subs = [...(opts.subdomains ?? [])];
	const original = globalThis.fetch;
	const ok = (result: unknown) => Response.json({ success: true, result });
	globalThis.fetch = (async (input: string, init?: RequestInit) => {
		const url = String(input);
		const method = init?.method ?? "GET";
		calls.push({ method, url });
		if (url.includes("/zones?")) return ok([{ id: "z1", name: "a.test", status: "active" }]);
		if (url.includes("/email/sending/subdomains") && url.endsWith("/dns")) return ok(opts.dnsRecords ?? []);
		if (url.includes("/email/sending/subdomains/") && method === "DELETE") return ok({});
		if (url.includes("/email/sending/subdomains") && method === "POST") {
			const created = { tag: "sub1", name: "mail.a.test", enabled: false };
			subs.push(created);
			return ok(created);
		}
		if (url.includes("/email/sending/subdomains")) return ok(subs);
		if (url.includes("/dns_records") && method === "POST") {
			return opts.failDnsWrite
				? Response.json({ success: false, errors: [{ code: 9999, message: "nope" }] }, { status: 400 })
				: ok({});
		}
		if (url.includes("/dns_records")) {
			const q = new URL(url).searchParams;
			return ok(opts.zoneRecords?.[`${q.get("type")}:${q.get("name")}`] ?? []);
		}
		if (url.includes("/email/routing/enable"))
			return opts.failRouting
				? Response.json({ success: false, errors: [{ code: 1, message: "no" }] }, { status: 500 })
				: ok({});
		if (url.includes("rules/catch_all") && method === "PUT")
			return opts.failRouting
				? Response.json({ success: false, errors: [{ code: 1, message: "no" }] }, { status: 500 })
				: ok({});
		if (url.includes("rules/catch_all")) {
			return opts.catchAll === "error" || opts.catchAll === undefined
				? Response.json({ success: false, errors: [{ code: 1, message: "none" }] }, { status: 404 })
				: ok(opts.catchAll);
		}
		return Response.json({ success: false, errors: [{ code: 1, message: `unstubbed ${url}` }] }, { status: 500 });
	}) as typeof fetch;
	return { calls, restore: () => void (globalThis.fetch = original) };
}

function env(initialDomains: Array<Record<string, unknown>> = []) {
	const domains = [...initialDomains];
	const writes: string[] = [];
	const db = fakeDB((sql, args) => {
		if (sql.startsWith("INSERT INTO domains")) {
			writes.push(sql);
			domains.push({ name: args[1] });
			return {};
		}
		if (sql.includes("FROM domains"))
			return { all: domains, first: domains.find((d) => d.name === args[0] || d.id === args[0]) };
		return {};
	});
	return {
		writes,
		env: { DB: db, RATE_LIMIT_KV: fakeKV(), CF_API_TOKEN: "t", INBOX_WORKER_NAME: "emailflare" } as never,
	};
}

const base = { name: "mail.a.test", zoneName: "a.test", receiving: true };

test("preflight reads the zone and writes nothing", async () => {
	const cf = cloudflare({
		subdomains: [{ tag: "sub1", name: "mail.a.test", enabled: true }],
		dnsRecords: [
			{ type: "TXT", name: "mail.a.test", content: "v=spf1 -all", ttl: 1 },
			{ type: "TXT", name: "cf._domainkey.mail.a.test", content: "k=rsa", ttl: 1 },
		],
		zoneRecords: {
			"MX:a.test": [{ type: "MX", name: "a.test", content: "aspmx.l.google.com", priority: 1 }],
			"TXT:mail.a.test": [{ type: "TXT", name: "mail.a.test", content: '"v=spf1 -all"' }],
		},
		catchAll: { enabled: true, actions: [{ type: "forward", value: ["me@x.test"] }] },
	});
	try {
		const { env: e, writes } = env();
		const res = await previewDomain(e, base);
		assert.ok(res.ok);
		if (!res.ok) return;
		assert.equal(res.facts.sendingSubdomain, "exists");
		assert.deepEqual(res.facts.sendingRecords, { present: 1, missing: 1 });
		assert.equal(res.facts.mx.state, "other");
		assert.equal(res.facts.catchAll.state, "elsewhere");
		assert.equal(res.facts.dmarc, "absent");
		assert.equal(res.plan.receivingDefault, false);
		assert.equal(writes.length, 0);
		assert.ok(
			cf.calls.every((c) => c.method === "GET"),
			"preflight must only read",
		);
	} finally {
		cf.restore();
	}
});

test("preflight reports a domain that is already registered", async () => {
	const cf = cloudflare({});
	try {
		const res = await previewDomain(env([{ name: "mail.a.test" }]).env, base);
		assert.ok(res.ok && res.plan.blocked);
	} finally {
		cf.restore();
	}
});

test("each stage is safe to repeat: an existing sending domain is reused, not recreated", async () => {
	const cf = cloudflare({ subdomains: [{ tag: "sub1", name: "mail.a.test", enabled: false }] });
	try {
		const result = await runDomainStep(env().env, { ...base, step: "sending" });
		assert.equal(result.status, "done");
		assert.match(result.message, /already exists/);
		assert.ok(!cf.calls.some((c) => c.method === "POST"));
	} finally {
		cf.restore();
	}
});

test("a DNS write failure is a warning that carries the records to add by hand", async () => {
	const cf = cloudflare({
		subdomains: [{ tag: "sub1", name: "mail.a.test", enabled: false }],
		dnsRecords: [{ type: "TXT", name: "mail.a.test", content: "v=spf1 -all", ttl: 1 }],
		failDnsWrite: true,
	});
	try {
		const result = await runDomainStep(env().env, { ...base, step: "dns" });
		assert.equal(result.status, "warning");
		assert.equal(result.dnsStatus, "manual");
		assert.equal(result.records?.[0].content, "v=spf1 -all");
	} finally {
		cf.restore();
	}
});

test("routing is skipped, and never touches Cloudflare, when receiving is off", async () => {
	const cf = cloudflare({ subdomains: [{ tag: "sub1", name: "mail.a.test", enabled: true }] });
	try {
		const result = await runDomainStep(env().env, { ...base, receiving: false, step: "routing" });
		assert.equal(result.status, "skipped");
		assert.equal(cf.calls.length, 0);
	} finally {
		cf.restore();
	}
});

test("a routing failure is reported as failed so it can be retried on its own", async () => {
	const cf = cloudflare({ failRouting: true });
	try {
		const result = await runDomainStep(env().env, { ...base, step: "routing" });
		assert.equal(result.status, "failed");
	} finally {
		cf.restore();
	}
});

test("save inserts the domain once, even if the stage is repeated", async () => {
	const cf = cloudflare({
		subdomains: [{ tag: "sub1", name: "mail.a.test", enabled: true }],
		catchAll: { enabled: true, actions: [{ type: "worker", value: ["emailflare"] }] },
	});
	try {
		const { env: e, writes } = env();
		const first = await runDomainStep(e, { ...base, step: "save", dnsStatus: "written" });
		assert.equal(first.status, "done");
		const again = await runDomainStep(e, { ...base, step: "save" });
		assert.equal(again.status, "done");
		assert.match(again.message, /Already saved/);
		assert.equal(writes.length, 1);
	} finally {
		cf.restore();
	}
});

// ── Domain detail ─────────────────────────────────────────────────────────────

const row = { id: "d1", name: "mail.a.test", cf_zone_id: "z1", cf_subdomain_id: "sub1", verified: 1 };

test("each expected record is compared with the zone, and only missing ones are written", async () => {
	const cf = cloudflare({
		subdomains: [{ tag: "sub1", name: "mail.a.test", enabled: true }],
		dnsRecords: [
			{ type: "TXT", name: "mail.a.test", content: "v=spf1 -all", ttl: 1 },
			{ type: "TXT", name: "cf._domainkey.mail.a.test", content: "k=rsa", ttl: 1 },
			{ type: "MX", name: "mail.a.test", content: "mx.example.net", ttl: 1 },
		],
		zoneRecords: {
			"TXT:mail.a.test": [{ type: "TXT", name: "mail.a.test", content: '"v=spf1 -all"' }],
			"MX:mail.a.test": [{ type: "MX", name: "mail.a.test", content: "other.example.net" }],
		},
	});
	try {
		const { env: e } = env([row]);
		const check = await checkDomainRecords(e, "d1");
		assert.deepEqual(
			check.records.map((r) => r.status),
			["ok", "missing", "wrong"],
		);
		await fixDomainRecords(e, "d1");
		const writes = cf.calls.filter((c) => c.method === "POST" && c.url.includes("/dns_records"));
		assert.equal(writes.length, 1, "only the missing record is written; the different one is left alone");
	} finally {
		cf.restore();
	}
});

test("a mailbox never replaces a catch-all that sends mail elsewhere", async () => {
	const cf = cloudflare({ catchAll: { enabled: true, actions: [{ type: "forward", value: ["me@x.test"] }] } });
	try {
		const result = await configureInboxRouting(env().env, "support@a.test");
		assert.equal(result.configured, false);
		assert.match(result.error ?? "", /forward: me@x\.test/);
		assert.ok(!cf.calls.some((c) => c.method === "PUT"));
	} finally {
		cf.restore();
	}
});

test("a mailbox turns routing on when nothing is routed, and leaves our own rule alone", async () => {
	const none = cloudflare({ catchAll: { enabled: false, actions: [] } });
	try {
		assert.equal((await configureInboxRouting(env().env, "support@a.test")).configured, true);
		assert.ok(none.calls.some((c) => c.method === "PUT"));
	} finally {
		none.restore();
	}
	const ours = cloudflare({ catchAll: { enabled: true, actions: [{ type: "worker", value: ["emailflare"] }] } });
	try {
		assert.equal((await configureInboxRouting(env().env, "support@a.test")).configured, true);
		assert.ok(!ours.calls.some((c) => c.method === "PUT"));
	} finally {
		ours.restore();
	}
});

test("removing a domain only touches Cloudflare for what was asked, and keeps the row if cleanup fails", async () => {
	const cf = cloudflare({ catchAll: { enabled: true, actions: [{ type: "worker", value: ["emailflare"] }] } });
	const original = globalThis.fetch;
	try {
		const plain = env([row]);
		const res = await removeDomain(plain.env, "d1", { deleteSending: false, stopRouting: false });
		assert.ok(res.ok);
		assert.equal(cf.calls.length, 0, "EmailFlare-only removal makes no Cloudflare calls");

		const cleanup = env([row]);
		const full = await removeDomain(cleanup.env, "d1", { deleteSending: true, stopRouting: true });
		assert.ok(full.ok && full.cleaned.length === 2);
		assert.ok(cf.calls.some((c) => c.method === "DELETE" && c.url.includes("/subdomains/sub1")));
		assert.ok(cf.calls.some((c) => c.method === "PUT" && c.url.includes("catch_all")));
	} finally {
		cf.restore();
		globalThis.fetch = original;
	}
});
