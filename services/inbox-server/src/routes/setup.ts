// POST /api/setup   — create first admin user
// GET  /api/setup/status

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { generateId } from "@emailflare/email-core";
import { hashPassword } from "../lib/password.js";
import { saveSession } from "../middleware/auth.js";
import { rawDb } from "../db.js";
import type { HonoEnv } from "../env.js";

const app = new Hono<HonoEnv>();

app.get("/status", async (c) => {
	try {
		const row = await rawDb.first("SELECT id FROM users LIMIT 1");
		return c.json({ initialized: !!row });
	} catch {
		// users table doesn't exist yet (migrations pending) — treat as uninitialized
		return c.json({ initialized: false });
	}
});

const setupSchema = z.object({
	name: z.string().min(1).max(100),
	email: z.string().email().toLowerCase(),
	password: z.string().min(8),
});

app.post("/", zValidator("json", setupSchema), async (c) => {
	const existing = await rawDb.first("SELECT id FROM users LIMIT 1");
	if (existing) return c.json({ error: "already_initialized" }, 409);

	const { name, email, password } = c.req.valid("json");
	const passwordHash = await hashPassword(password);
	const id = generateId();
	const now = new Date().toISOString();

	await rawDb.run("INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
		id,
		name,
		email,
		passwordHash,
		"super-admin",
		now,
	]);

	await saveSession(c, { userId: id, role: "super-admin", name, email });
	return c.json({ ok: true }, 201);
});

export default app;
