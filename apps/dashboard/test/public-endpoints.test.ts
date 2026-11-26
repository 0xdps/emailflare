import assert from "node:assert/strict";
import test from "node:test";
import type { Hono } from "hono";
import { instrumentTracking, timingSafeEqual, trackingSignature } from "../lib/core/index.ts";
import setupRouter from "../worker/inbox/routes/setup.ts";
import trackingRouter from "../worker/inbox/routes/tracking.ts";
import { withSecurityHeaders } from "../worker/inbox/lib/security-headers.ts";
import type { HonoEnv } from "../worker/inbox/env.ts";
import { SECRET, appWith, fakeDB, fakeKV } from "./helpers.ts";

// ── Tracking ──────────────────────────────────────────────────────────────────

test("tracked links are signed and carry the real URL, not its HTML-escaped form", async () => {
	const html = '<a href="https://a.example/x?y=1&amp;z=2">go</a><a href="https://a.example/p">p</a></body>';
	const out = await instrumentTracking(html, "https://app.example", "tok1", SECRET);
	const links = [...out.matchAll(/href="(https:\/\/app\.example\/v1\/t\/c\/tok1\?[^"]+)"/g)].map(
		(m) => new URL(m[1]),
	);
	assert.equal(links.length, 2);
	assert.equal(links[0].searchParams.get("u"), "https://a.example/x?y=1&z=2");
	assert.equal(
		links[0].searchParams.get("s"),
		await trackingSignature(SECRET, "tok1", "https://a.example/x?y=1&z=2"),
	);
	assert.match(out, /\/v1\/t\/o\/tok1/);
});

function trackingApp(issued: boolean) {
	const db = fakeDB((sql) => (sql.includes("FROM email_events") ? { first: issued ? { ok: 1 } : null } : undefined));
	return { db, ...appWith(trackingRouter as unknown as Hono<HonoEnv>, "/v1/t", { DB: db, SESSION_SECRET: SECRET }) };
}

test("a signed click redirects, and is recorded only for an issued token", async () => {
	const url = "https://dest.example/page";
	const sig = await trackingSignature(SECRET, "tok", url);
	const issued = trackingApp(true);
	const res = await issued.request(`/v1/t/c/tok?u=${encodeURIComponent(url)}&s=${sig}`);
	assert.equal(res.status, 302);
	assert.equal(res.headers.get("location"), url);
	await Promise.all(issued.waits);
	assert.ok(issued.db.calls.some((c) => c.sql.startsWith("INSERT INTO email_events")));

	const unknown = trackingApp(false);
	const res2 = await unknown.request(`/v1/t/c/tok?u=${encodeURIComponent(url)}&s=${sig}`);
	assert.equal(res2.status, 302);
	await Promise.all(unknown.waits);
	assert.ok(!unknown.db.calls.some((c) => c.sql.startsWith("INSERT INTO email_events")));
});

test("an unsigned or forged click never redirects; it shows the destination", async () => {
	const evil = 'https://evil.example/"><script>x</script>';
	for (const query of [`u=${encodeURIComponent(evil)}`, `u=${encodeURIComponent(evil)}&s=${"0".repeat(64)}`]) {
		const res = await trackingApp(true).request(`/v1/t/c/tok?${query}`);
		assert.equal(res.status, 200);
		assert.equal(res.headers.get("location"), null);
		const body = await res.text();
		assert.doesNotMatch(body, /<script>x/);
		assert.match(body, /evil\.example/);
	}
});

test("non-web destinations are not followed", async () => {
	const res = await trackingApp(true).request(`/v1/t/c/tok?u=${encodeURIComponent("javascript:alert(1)")}`);
	assert.equal(res.status, 302);
	assert.equal(res.headers.get("location"), "/");
});

test("timingSafeEqual compares whole values", () => {
	assert.equal(timingSafeEqual("abc", "abc"), true);
	assert.equal(timingSafeEqual("abc", "abd"), false);
	assert.equal(timingSafeEqual("abc", "abcd"), false);
});

// ── Security headers ──────────────────────────────────────────────────────────

test("responses get framing, sniffing and referrer protections without overriding existing ones", () => {
	const html = withSecurityHeaders(
		new Request("https://app.example/inbox"),
		new Response("<p>x</p>", { headers: { "Content-Type": "text/html; charset=utf-8" } }),
	);
	assert.equal(html.headers.get("x-frame-options"), "DENY");
	assert.equal(html.headers.get("x-content-type-options"), "nosniff");
	assert.match(html.headers.get("content-security-policy")!, /frame-ancestors 'none'/);
	assert.ok(html.headers.get("strict-transport-security"));
	// Fetch-restricting directives would apply to email srcdoc iframes, so none are set.
	assert.doesNotMatch(html.headers.get("content-security-policy")!, /default-src|img-src|script-src/);

	const json = withSecurityHeaders(new Request("https://app.example/api/x"), Response.json({ ok: true }));
	assert.equal(json.headers.get("content-security-policy"), null);

	const own = withSecurityHeaders(
		new Request("https://app.example/api/inbox/attachments/1"),
		new Response("x", { headers: { "Content-Security-Policy": "default-src 'none'; sandbox" } }),
	);
	assert.equal(own.headers.get("content-security-policy"), "default-src 'none'; sandbox");

	const local = withSecurityHeaders(new Request("http://localhost:5173/"), new Response("x"));
	assert.equal(local.headers.get("strict-transport-security"), null);
});

// ── First-run setup ───────────────────────────────────────────────────────────

function setupApp(opts: { users?: boolean; token?: string; insertChanges?: number }) {
	const db = fakeDB((sql) => {
		if (sql.startsWith("INSERT INTO users")) return { changes: opts.insertChanges ?? 1 };
		if (sql.includes("FROM users")) return { first: opts.users ? { id: "x" } : null };
	});
	const app = appWith(setupRouter as unknown as Hono<HonoEnv>, "/api/setup", {
		DB: db,
		RATE_LIMIT_KV: fakeKV(),
		SESSION_SECRET: SECRET,
		SETUP_TOKEN: opts.token,
	});
	const create = (body: Record<string, unknown>) =>
		app.request("/api/setup", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Ada", email: "ada@example.com", password: "long-enough-pw", ...body }),
		});
	return { db, create, status: () => app.request("/api/setup/status") };
}

test("setup requires the setup token when one is configured", async () => {
	const app = setupApp({ token: "s3cret" });
	assert.equal(((await (await app.status()).json()) as { requiresToken: boolean }).requiresToken, true);
	assert.equal((await app.create({})).status, 403);
	assert.equal((await app.create({ setupToken: "wrong" })).status, 403);
	assert.equal((await app.create({ setupToken: "s3cret" })).status, 201);
});

test("setup is open without a token, and refuses once an admin exists or a race was lost", async () => {
	assert.equal((await setupApp({}).create({})).status, 201);
	assert.equal((await setupApp({ users: true }).create({})).status, 409);
	assert.equal((await setupApp({ insertChanges: 0 }).create({})).status, 409);
});
