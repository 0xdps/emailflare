// Auth routes: login, logout, me
// Uses email+password with PBKDF2 via Web Crypto API.

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../lib/password.ts";
import { getSession, saveSession, clearSession } from "../middleware/auth.ts";
import { checkLoginRateLimit } from "../middleware/loginRateLimit.ts";
import { sendEmail } from "../services/cloudflare.ts";
import { hashBackupCode, verifyTotp } from "../lib/totp.ts";
import type { HonoEnv } from "../env.ts";
import { generateId, userLoginSchema } from "@/lib/core";

const app = new Hono<HonoEnv>();

// POST /api/auth/login
app.post("/login", zValidator("json", userLoginSchema), async (c) => {
	const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0].trim() ?? "unknown";

	const allowed = await checkLoginRateLimit(ip, c.env.RATE_LIMIT_KV);
	if (!allowed) return c.json({ error: "Too many login attempts. Try again in a minute." }, 429);

	const { email, password } = c.req.valid("json");

	const user = await c.env.DB.prepare(
		"SELECT id, name, email, password_hash, user_type, access_types, totp_enabled, totp_secret FROM users WHERE email = ? LIMIT 1",
	)
		.bind(email)
		.first<{
			id: string;
			name: string;
			email: string;
			password_hash: string;
			user_type: "admin" | "member";
			access_types: string;
			totp_enabled: number;
			totp_secret: string | null;
		}>();

	if (!user) {
		// Constant-time dummy hash comparison to prevent user enumeration
		await verifyPassword(password, "$dummy$");
		return c.json({ error: "Invalid email or password" }, 401);
	}

	const valid = await verifyPassword(password, user.password_hash);
	if (!valid) return c.json({ error: "Invalid email or password" }, 401);

	if (user.totp_enabled === 1 && user.totp_secret) {
		const code = c.req.header("X-EmailFlare-OTP") ?? "";
		const totpOk = code ? await verifyTotp(user.totp_secret, code) : false;
		if (!totpOk) {
			const backup = code ? await hashBackupCode(code) : "";
			const unused = backup
				? await c.env.DB.prepare(
						"SELECT id FROM user_backup_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL LIMIT 1",
					)
						.bind(user.id, backup)
						.first<{ id: string }>()
				: null;
			if (!unused) return c.json({ error: "totp_required" }, 401);
			await c.env.DB.prepare("UPDATE user_backup_codes SET used_at = ? WHERE id = ?")
				.bind(new Date().toISOString(), unused.id)
				.run();
		}
	}

	const userType: "admin" | "member" = user.user_type === "admin" ? "admin" : "member";

	let accessTypes: ("inbox" | "api" | "tester")[];
	if (userType === "admin") {
		accessTypes = ["inbox", "api", "tester"];
	} else {
		try {
			const parsed = JSON.parse(user.access_types || "[]");
			accessTypes = Array.isArray(parsed) ? parsed : [];
		} catch {
			accessTypes = [];
		}
	}

	await saveSession(c, {
		userId: user.id,
		userType,
		accessTypes,
		name: user.name,
		email: user.email,
	});
	return c.json({ ok: true });
});

// POST /api/auth/logout
app.post("/logout", (c) => {
	clearSession(c);
	return c.json({ ok: true });
});

// GET /api/auth/me — returns user from session cookie (no DB query needed;
// userType, accessTypes, name, and email are embedded in the JWT at login time).
app.get("/me", async (c) => {
	const session = await getSession(c);
	if (!session) return c.json({ error: "Unauthorized" }, 401);

	return c.json({
		id: session.userId,
		name: session.name,
		email: session.email,
		user_type: session.userType,
		access_types: session.accessTypes,
	});
});

const RESET_TTL = 15 * 60;
const forgotSchema = z.object({ email: z.string().email().toLowerCase() });
const resetSchema = z.object({
	token: z.string().min(20),
	password: z.string().min(8).max(200),
});

function resetKey(token: string) {
	return `pwreset:${token}`;
}

// POST /api/auth/forgot-password
// Always returns ok. A missing account, missing sender, or send failure is not revealed.
app.post("/forgot-password", zValidator("json", forgotSchema), async (c) => {
	const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0].trim() ?? "unknown";
	const allowed = await checkLoginRateLimit(`reset:${ip}`, c.env.RATE_LIMIT_KV);
	if (!allowed) return c.json({ error: "Too many reset attempts. Try again in a minute." }, 429);

	const { email } = c.req.valid("json");
	const user = await c.env.DB.prepare("SELECT id, email FROM users WHERE email = ? LIMIT 1")
		.bind(email)
		.first<{ id: string; email: string }>();
	const domain = await c.env.DB.prepare(
		"SELECT name FROM domains WHERE verified = 1 ORDER BY created_at ASC LIMIT 1",
	).first<{ name: string }>();
	const origin = (c.env.PUBLIC_URL || new URL(c.req.url).origin).replace(/\/$/, "");

	if (user && domain && c.env.CF_API_TOKEN && c.env.CF_ACCOUNT_ID) {
		const token = generateId() + generateId();
		await c.env.RATE_LIMIT_KV.put(resetKey(token), user.id, { expirationTtl: RESET_TTL });
		const link = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
		try {
			await sendEmail(
				{
					from: { address: `noreply@${domain.name}`, name: "EmailFlare" },
					to: user.email,
					subject: "Reset your EmailFlare password",
					text: `Reset your password: ${link}\n\nThis link expires in 15 minutes. If you did not ask for this, ignore this email.`,
					html: `<p>Reset your EmailFlare password.</p><p><a href="${link}">Choose a new password</a></p><p>This link expires in 15 minutes. If you did not ask for this, ignore this email.</p>`,
				},
				c.env.CF_API_TOKEN,
				c.env.CF_ACCOUNT_ID,
			);
		} catch {
			await c.env.RATE_LIMIT_KV.delete(resetKey(token));
		}
	}

	return c.json({
		ok: true,
		message: "If that account can receive mail, a reset link is on its way. The link expires in 15 minutes.",
	});
});

// POST /api/auth/reset-password
app.post("/reset-password", zValidator("json", resetSchema), async (c) => {
	const { token, password } = c.req.valid("json");
	const key = resetKey(token);
	const userId = await c.env.RATE_LIMIT_KV.get(key);
	if (!userId) return c.json({ error: "This reset link is invalid or expired." }, 400);

	const passwordHash = await hashPassword(password);
	const updated = await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
		.bind(passwordHash, userId)
		.run();
	await c.env.RATE_LIMIT_KV.delete(key);
	if (!updated.meta.changes) return c.json({ error: "This reset link is invalid or expired." }, 400);
	return c.json({ ok: true });
});

export default app;
