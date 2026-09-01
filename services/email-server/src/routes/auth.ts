import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { env } from "../env.js";
import { getSession, saveSession, clearSession } from "../middleware/auth.js";
import { checkLoginRateLimit } from "../middleware/loginRateLimit.js";
import { adminLoginSchema } from "@emailflare/email-core";

const app = new Hono();

// POST /api/auth/login — public, no session required
app.post("/login", zValidator("json", adminLoginSchema), async (c) => {
	const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0].trim() ?? "unknown";

	if (!checkLoginRateLimit(ip)) {
		return c.json({ error: "Too many login attempts. Try again in a minute." }, 429);
	}

	const { token } = c.req.valid("json");

	const expected = Buffer.from(env.ADMIN_TOKEN);
	const provided = Buffer.from(token);
	const valid = provided.length === expected.length && timingSafeEqual(expected, provided);

	if (!valid) return c.json({ error: "Invalid token" }, 401);

	await saveSession(c, { isLoggedIn: true });
	return c.json({ ok: true });
});

// POST /api/auth/logout — public, clears session
app.post("/logout", (c) => {
	clearSession(c);
	return c.json({ ok: true });
});

// GET /api/auth/me — reads session cookie; not sensitive (returns only isLoggedIn bool)
app.get("/me", async (c) => {
	const session = await getSession(c);
	return c.json({ ok: session.isLoggedIn });
});

export default app;
