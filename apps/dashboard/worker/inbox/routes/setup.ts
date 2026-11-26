// First-run setup: POST /api/setup  —  GET /api/setup/status
// Creates the admin user account. 409 if already initialized.
// When the SETUP_TOKEN secret is set, the request must present it, so nobody who finds a
// fresh deployment first can claim the admin account.

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { generateId, timingSafeEqual } from "@/lib/core";
import { checkLoginRateLimit } from "../middleware/loginRateLimit.ts";
import { hashPassword } from "../lib/password.ts";
import { saveSession } from "../middleware/auth.ts";
import type { HonoEnv } from "../env.ts";

const app = new Hono<HonoEnv>();

// GET /api/setup/status
app.get("/status", async (c) => {
	const row = await c.env.DB.prepare("SELECT id FROM users LIMIT 1").first();
	return c.json({ initialized: !!row, requiresToken: !!c.env.SETUP_TOKEN?.trim() });
});

const setupSchema = z.object({
	name: z.string().min(1).max(100),
	email: z.string().email().toLowerCase(),
	password: z.string().min(8).max(200),
	setupToken: z.string().max(200).optional(),
});

// POST /api/setup
app.post("/", zValidator("json", setupSchema), async (c) => {
	const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0].trim() ?? "unknown";
	if (!(await checkLoginRateLimit(`setup:${ip}`, c.env.RATE_LIMIT_KV))) {
		return c.json({ error: "Too many attempts. Try again in a minute." }, 429);
	}

	const existing = await c.env.DB.prepare("SELECT id FROM users LIMIT 1").first();
	if (existing) return c.json({ error: "already_initialized" }, 409);

	const { name, email, password, setupToken } = c.req.valid("json");
	const requiredToken = c.env.SETUP_TOKEN?.trim();
	if (requiredToken && !timingSafeEqual(setupToken ?? "", requiredToken)) {
		return c.json({ error: "invalid_setup_token" }, 403);
	}

	const passwordHash = await hashPassword(password);
	const id = generateId();
	const now = new Date().toISOString();

	// Insert only while the table is empty, so two simultaneous requests can't both become admin.
	const inserted = await c.env.DB.prepare(
		`INSERT INTO users (id, name, email, password_hash, user_type, access_types, created_at)
		 SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM users)`,
	)
		.bind(id, name, email, passwordHash, "admin", JSON.stringify(["inbox", "api", "tester"]), now)
		.run();
	if (!inserted.meta.changes) return c.json({ error: "already_initialized" }, 409);

	await saveSession(c, {
		userId: id,
		userType: "admin",
		accessTypes: ["inbox", "api", "tester"],
		name,
		email,
	});
	return c.json({ ok: true }, 201);
});

export default app;
