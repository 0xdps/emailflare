import assert from "node:assert/strict";
import test from "node:test";

process.env.MESAHUB_URL = "mh://dummy@localhost:8080/db";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.SESSION_SECRET = "01234567890123456789012345678901";

import { Hono } from "hono";
import type { HonoEnv } from "../src/env.ts";
import keysRouter from "../src/routes/keys.ts";

function createTestApp(userRole?: "member" | "tester" | "admin" | "super-admin") {
	const app = new Hono<HonoEnv>();
	app.use("*", async (c, next) => {
		if (userRole) {
			c.set("userId", "test-user-id");
			c.set("userRole", userRole);
		}
		await next();
	});
	app.route("/api/keys", keysRouter);
	return app;
}

test("member role is rejected with 403 Forbidden across all /api/keys endpoints", async () => {
	const app = createTestApp("member");

	const resGet = await app.request("/api/keys");
	assert.equal(resGet.status, 403);

	const resPost = await app.request("/api/keys", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: "escalated-key" }),
	});
	assert.equal(resPost.status, 403);

	const resDelete = await app.request("/api/keys/key_123", {
		method: "DELETE",
	});
	assert.equal(resDelete.status, 403);
});

test("tester role is rejected with 403 Forbidden across all /api/keys endpoints", async () => {
	const app = createTestApp("tester");

	const resGet = await app.request("/api/keys");
	assert.equal(resGet.status, 403);

	const resPost = await app.request("/api/keys", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: "escalated-key" }),
	});
	assert.equal(resPost.status, 403);
});

test("unauthenticated request with no role is rejected with 403 Forbidden", async () => {
	const app = createTestApp(undefined);

	const resGet = await app.request("/api/keys");
	assert.equal(resGet.status, 403);

	const resPost = await app.request("/api/keys", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: "escalated-key" }),
	});
	assert.equal(resPost.status, 403);
});
