import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getSession, saveSession, clearSession } from "../middleware/auth.ts";
import { checkLoginRateLimit } from "../middleware/loginRateLimit.ts";
import type { HonoEnv } from "../env.ts";
import { adminLoginSchema } from "@emailflare/email-core";

const app = new Hono<HonoEnv>();

// Timing-safe string comparison using HMAC (no Node.js crypto.timingSafeEqual).
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
	if (a.length !== b.length) return false;
	const encoder = new TextEncoder();
	const key = (await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256" }, false, ["sign"])) as CryptoKey;
	const [sigA, sigB] = await Promise.all([
		crypto.subtle.sign("HMAC", key, encoder.encode(a)),
		crypto.subtle.sign("HMAC", key, encoder.encode(b)),
	]);
	const bufA = new Uint8Array(sigA);
	const bufB = new Uint8Array(sigB);
	let diff = 0;
	for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
	return diff === 0;
}

// POST /api/auth/login
app.post("/login", zValidator("json", adminLoginSchema), async (c) => {
	const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0].trim() ?? "unknown";

	const allowed = await checkLoginRateLimit(ip, c.env.RATE_LIMIT_KV);
	if (!allowed) {
		return c.json({ error: "Too many login attempts. Try again in a minute." }, 429);
	}

	const { token } = c.req.valid("json");
	const valid = await timingSafeEqual(token, c.env.ADMIN_TOKEN);
	if (!valid) return c.json({ error: "Invalid token" }, 401);

	await saveSession(c, { isLoggedIn: true });
	return c.json({ ok: true });
});

// POST /api/auth/logout
app.post("/logout", (c) => {
	clearSession(c);
	return c.json({ ok: true });
});

// GET /api/auth/me
app.get("/me", async (c) => {
	const session = await getSession(c);
	return c.json({ ok: session.isLoggedIn });
});

export default app;
