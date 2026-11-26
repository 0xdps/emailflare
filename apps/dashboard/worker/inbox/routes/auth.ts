// Auth routes: login, logout, me
// Uses email+password with PBKDF2 via Web Crypto API.

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../lib/password.ts";
import { getSession, saveSession, clearSession } from "../middleware/auth.ts";
import { revokeSessions } from "../lib/session.ts";
import { checkLoginRateLimit } from "../middleware/loginRateLimit.ts";
import { sendEmail } from "../services/cloudflare.ts";
import { matchBackupCode, matchTotpStep } from "../lib/totp.ts";
import { writeAudit } from "../lib/audit.ts";
import type { HonoEnv } from "../env.ts";
import { generateId, userLoginSchema } from "@/lib/core";

const app = new Hono<HonoEnv>();

const LOCKOUT_FAILURES = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const TOTP_REPLAY_TTL = 120; // seconds; a code is valid for 90s at most

// Lets a missing account cost as much as a real one, so response time doesn't reveal which emails exist.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword("emailflare-timing-equaliser"));

// Failures live in the audit log (D1), which is strongly consistent. KV counters race under
// parallel requests, and the lockout is keyed on the account, so rotating IPs does not help.
async function isLockedOut(db: D1Database, email: string): Promise<boolean> {
	const since = new Date(Date.now() - LOCKOUT_WINDOW_MS).toISOString();
	const row = await db
		.prepare(
			"SELECT COUNT(*) AS n FROM audit_log WHERE action = 'auth.login_failed' AND target_id = ? AND created_at > ?",
		)
		.bind(email, since)
		.first<{ n: number }>();
	return (row?.n ?? 0) >= LOCKOUT_FAILURES;
}

function recordLoginFailure(db: D1Database, email: string, reason: string, ip: string, userId?: string) {
	return writeAudit(db, {
		actorId: userId ?? null,
		action: "auth.login_failed",
		targetType: "login",
		targetId: email,
		detail: `${reason} ip=${ip}`,
	});
}

// POST /api/auth/login
app.post("/login", zValidator("json", userLoginSchema), async (c) => {
	const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0].trim() ?? "unknown";

	const allowed = await checkLoginRateLimit(ip, c.env.RATE_LIMIT_KV);
	if (!allowed) return c.json({ error: "Too many login attempts. Try again in a minute." }, 429);

	const { email, password } = c.req.valid("json");

	if (await isLockedOut(c.env.DB, email)) {
		return c.json({ error: "Too many failed attempts for this account. Try again in 15 minutes." }, 429);
	}

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
		await verifyPassword(password, await getDummyHash());
		await recordLoginFailure(c.env.DB, email, "unknown_user", ip);
		return c.json({ error: "Invalid email or password" }, 401);
	}

	const valid = await verifyPassword(password, user.password_hash);
	if (!valid) {
		await recordLoginFailure(c.env.DB, email, "bad_password", ip, user.id);
		return c.json({ error: "Invalid email or password" }, 401);
	}

	if (user.totp_enabled === 1 && user.totp_secret) {
		const code = c.req.header("X-EmailFlare-OTP") ?? "";
		// First step of the two-step form: the password was right, now ask for the code.
		if (!code) return c.json({ error: "totp_required" }, 401);

		let accepted = false;
		const step = await matchTotpStep(user.totp_secret, code);
		if (step !== null) {
			// A code that was already used to sign in is dead, even inside its validity window.
			const usedKey = `totp_used:${user.id}:${step}`;
			if (!(await c.env.RATE_LIMIT_KV.get(usedKey))) {
				await c.env.RATE_LIMIT_KV.put(usedKey, "1", { expirationTtl: TOTP_REPLAY_TTL });
				accepted = true;
			}
		} else {
			const codes = await c.env.DB.prepare(
				"SELECT id, code_hash FROM user_backup_codes WHERE user_id = ? AND used_at IS NULL",
			)
				.bind(user.id)
				.all<{ id: string; code_hash: string }>();
			const matchedId = await matchBackupCode(code, codes.results ?? []);
			if (matchedId) {
				// Single use: only the request that flips used_at may sign in.
				const burned = await c.env.DB.prepare(
					"UPDATE user_backup_codes SET used_at = ? WHERE id = ? AND used_at IS NULL",
				)
					.bind(new Date().toISOString(), matchedId)
					.run();
				accepted = !!burned.meta.changes;
			}
		}

		if (!accepted) {
			await recordLoginFailure(c.env.DB, email, "bad_code", ip, user.id);
			return c.json({ error: "totp_required" }, 401);
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
	await writeAudit(c.env.DB, {
		actorId: user.id,
		action: "auth.login",
		targetType: "user",
		targetId: user.id,
		detail: `ip=${ip}`,
	});
	return c.json({ ok: true });
});

// POST /api/auth/logout
app.post("/logout", (c) => {
	clearSession(c);
	return c.json({ ok: true });
});

// POST /api/auth/logout-all — sign this account out everywhere, including this browser
app.post("/logout-all", async (c) => {
	const session = await getSession(c);
	if (!session) return c.json({ error: "Unauthorized" }, 401);
	await revokeSessions(c.env.RATE_LIMIT_KV, session.userId);
	await writeAudit(c.env.DB, {
		actorId: session.userId,
		action: "auth.logout_all",
		targetType: "user",
		targetId: session.userId,
	});
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
	// Whoever held the old password may still hold a session; end all of them.
	await revokeSessions(c.env.RATE_LIMIT_KV, userId);
	await writeAudit(c.env.DB, {
		actorId: userId,
		action: "user.reset_password",
		targetType: "user",
		targetId: userId,
	});
	return c.json({ ok: true });
});

const changePasswordSchema = z.object({
	currentPassword: z.string().min(1, "Current password is required"),
	newPassword: z.string().min(8, "New password must be at least 8 characters").max(200),
});

// POST /api/auth/change-password
app.post("/change-password", zValidator("json", changePasswordSchema), async (c) => {
	const session = await getSession(c);
	if (!session) return c.json({ error: "Unauthorized" }, 401);

	const { currentPassword, newPassword } = c.req.valid("json");

	if (currentPassword === newPassword) {
		return c.json({ error: "New password cannot be the same as your current password." }, 400);
	}

	const user = await c.env.DB.prepare("SELECT password_hash FROM users WHERE id = ? LIMIT 1")
		.bind(session.userId)
		.first<{ password_hash: string }>();

	if (!user) return c.json({ error: "User not found" }, 404);

	const valid = await verifyPassword(currentPassword, user.password_hash);
	if (!valid) {
		return c.json({ error: "Current password does not match." }, 400);
	}

	const passwordHash = await hashPassword(newPassword);
	await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(passwordHash, session.userId).run();

	// Sign out every other device, then give this browser a fresh session.
	await revokeSessions(c.env.RATE_LIMIT_KV, session.userId);
	await saveSession(c, session);

	await writeAudit(c.env.DB, {
		actorId: session.userId,
		action: "user.change_password",
		targetType: "user",
		targetId: session.userId,
	});

	return c.json({ ok: true, message: "Password updated successfully." });
});

export default app;
