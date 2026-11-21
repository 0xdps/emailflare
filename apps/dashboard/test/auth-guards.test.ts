import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { keyCreateSchema } from "../lib/core/index.ts";
import { guarded, requireAdmin, requireInbox, requireTester } from "../worker/inbox/middleware/auth.ts";
import type { HonoEnv } from "../worker/inbox/env.ts";

type Role = "admin" | "inbox-member" | "tester-member";

const router = (name: string) => {
	const r = new Hono<HonoEnv>();
	r.get("/", (c) => c.text(name));
	return r;
};

// Same shape as worker/inbox/index.ts: every router mounted at its own prefix behind one guard.
function buildApp() {
	const app = new Hono<HonoEnv>();
	app.use(
		"/*",
		createMiddleware<HonoEnv>(async (c, next) => {
			const role = c.req.header("x-role") as Role;
			c.set("userId", "u1");
			c.set("userType", role === "admin" ? "admin" : "member");
			c.set("accessTypes", role === "inbox-member" ? ["inbox"] : role === "tester-member" ? ["tester"] : []);
			await next();
		}),
	);
	app.route("/keys", guarded(requireAdmin, router("keys")));
	app.route("/test-emails", guarded(requireTester, router("test-emails")));
	app.route("/inbox/threads", guarded(requireInbox, router("threads")));
	app.route("/inbox/compose", guarded(requireInbox, router("compose")));
	return app;
}

const status = async (role: Role, path: string) =>
	(await buildApp().request(path, { headers: { "x-role": role } })).status;

test("a member with inbox access reaches inbox routes but not admin routes", async () => {
	assert.equal(await status("inbox-member", "/inbox/threads"), 200);
	assert.equal(await status("inbox-member", "/inbox/compose"), 200);
	assert.equal(await status("inbox-member", "/keys"), 403);
	assert.equal(await status("inbox-member", "/test-emails"), 403);
});

test("guards on one router never leak onto routers mounted after it", async () => {
	// A tester-only member must not be blocked by the admin guard on /keys, and vice versa.
	assert.equal(await status("tester-member", "/test-emails"), 200);
	assert.equal(await status("tester-member", "/inbox/threads"), 403);
	assert.equal(await status("tester-member", "/keys"), 403);
});

test("admins reach every router", async () => {
	for (const path of ["/keys", "/test-emails", "/inbox/threads", "/inbox/compose"]) {
		assert.equal(await status("admin", path), 200, path);
	}
});

test("API key creation fails closed when type or scope is omitted", () => {
	assert.equal(keyCreateSchema.safeParse({ name: "poc" }).success, false);
	assert.equal(keyCreateSchema.safeParse({ name: "poc", type: "live" }).success, false);
	assert.equal(keyCreateSchema.safeParse({ name: "poc", scope: "global" }).success, false);
	assert.equal(keyCreateSchema.safeParse({ name: "ok", type: "test", scope: "domain" }).success, true);
});
