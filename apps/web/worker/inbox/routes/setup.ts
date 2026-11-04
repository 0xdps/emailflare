// First-run setup: POST /api/setup  —  GET /api/setup/status
// Creates the admin user account. 409 if already initialized.

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { generateId } from "@emailflare/email-core";
import { hashPassword } from "../lib/password.ts";
import { saveSession } from "../middleware/auth.ts";
import type { HonoEnv } from "../env.ts";

const app = new Hono<HonoEnv>();

// GET /api/setup/status
app.get("/status", async (c) => {
	const row = await c.env.DB.prepare("SELECT id FROM users LIMIT 1").first();
	return c.json({ initialized: !!row });
});

const setupSchema = z.object({
	name: z.string().min(1).max(100),
	email: z.string().email().toLowerCase(),
	password: z.string().min(8),
});

// POST /api/setup
app.post("/", zValidator("json", setupSchema), async (c) => {
	const existing = await c.env.DB.prepare("SELECT id FROM users LIMIT 1").first();
	if (existing) return c.json({ error: "already_initialized" }, 409);

	const { name, email, password } = c.req.valid("json");
	const passwordHash = await hashPassword(password);
	const id = generateId();
	const now = new Date().toISOString();

	await c.env.DB.prepare(
		"INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
	)
		.bind(id, name, email, passwordHash, "super-admin", now)
		.run();

	await saveSession(c, { userId: id, role: "super-admin", name, email });
	return c.json({ ok: true }, 201);
});

export default app;
