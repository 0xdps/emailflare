import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { generateId } from "@/lib/core";
import { getSession } from "../middleware/auth.ts";
import { generateBackupCodes, generateTotpSecret, hashBackupCode, totpUri, verifyTotp } from "../lib/totp.ts";
import { writeAudit } from "../lib/audit.ts";
import type { HonoEnv } from "../env.ts";

const app = new Hono<HonoEnv>();

app.get("/status", async (c) => {
	const session = await getSession(c);
	if (!session) return c.json({ error: "Unauthorized" }, 401);
	const row = await c.env.DB.prepare("SELECT totp_enabled FROM users WHERE id = ?")
		.bind(session.userId)
		.first<{ totp_enabled: number }>();
	return c.json({ enabled: row?.totp_enabled === 1 });
});

app.post("/setup", async (c) => {
	const session = await getSession(c);
	if (!session) return c.json({ error: "Unauthorized" }, 401);
	const secret = generateTotpSecret();
	await c.env.RATE_LIMIT_KV.put(`totp-setup:${session.userId}`, secret, { expirationTtl: 600 });
	return c.json({ secret, uri: totpUri(secret, session.email) });
});

app.post("/enable", zValidator("json", z.object({ code: z.string().min(6).max(8) })), async (c) => {
	const session = await getSession(c);
	if (!session) return c.json({ error: "Unauthorized" }, 401);
	const secret = await c.env.RATE_LIMIT_KV.get(`totp-setup:${session.userId}`);
	if (!secret) return c.json({ error: "Start setup again. The secret expired." }, 400);
	const { code } = c.req.valid("json");
	if (!(await verifyTotp(secret, code))) return c.json({ error: "That code did not match." }, 400);
	const codes = generateBackupCodes();
	const now = new Date().toISOString();
	const hashes = await Promise.all(codes.map((code) => hashBackupCode(code)));
	await c.env.DB.batch([
		c.env.DB.prepare("UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?").bind(
			secret,
			session.userId,
		),
		...hashes.map((hash) =>
			c.env.DB.prepare(
				"INSERT INTO user_backup_codes (id, user_id, code_hash, used_at, created_at) VALUES (?, ?, ?, NULL, ?)",
			).bind(generateId(), session.userId, hash, now),
		),
	]);
	await c.env.RATE_LIMIT_KV.delete(`totp-setup:${session.userId}`);
	await writeAudit(c.env.DB, {
		actorId: session.userId,
		action: "totp.enable",
		targetType: "user",
		targetId: session.userId,
	});
	return c.json({ ok: true, backupCodes: codes });
});

app.post("/disable", zValidator("json", z.object({ code: z.string().min(6).max(12) })), async (c) => {
	const session = await getSession(c);
	if (!session) return c.json({ error: "Unauthorized" }, 401);
	const row = await c.env.DB.prepare("SELECT totp_secret FROM users WHERE id = ?")
		.bind(session.userId)
		.first<{ totp_secret: string | null }>();
	if (!row?.totp_secret || !(await verifyTotp(row.totp_secret, c.req.valid("json").code))) {
		return c.json({ error: "That code did not match." }, 400);
	}
	await c.env.DB.batch([
		c.env.DB.prepare("UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?").bind(session.userId),
		c.env.DB.prepare("DELETE FROM user_backup_codes WHERE user_id = ?").bind(session.userId),
	]);
	await writeAudit(c.env.DB, {
		actorId: session.userId,
		action: "totp.disable",
		targetType: "user",
		targetId: session.userId,
	});
	return c.json({ ok: true });
});

export default app;
