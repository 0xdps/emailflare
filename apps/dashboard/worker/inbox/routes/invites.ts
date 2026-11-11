// Invite management routes
// POST /api/admin/invites           — create invite (admin only)
// GET  /api/invites/:token          — validate token (public)
// POST /api/invites/:token/accept   — accept invite + create user (public)

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { generateId } from "@/lib/core";
import { requireSession, requireAdmin, saveSession } from "../middleware/auth.ts";
import { hashPassword } from "../lib/password.ts";
import { sendEmail } from "../services/cloudflare.ts";
import { writeAudit } from "../lib/audit.ts";
import type { HonoEnv } from "../env.ts";

const app = new Hono<HonoEnv>();

// Hash the raw token for storage (only hash is stored; raw token goes in URL)
async function sha256Hex(input: string): Promise<string> {
	const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

// POST /api/admin/invites
app.post(
	"/admin/invites",
	requireSession,
	requireAdmin,
	zValidator(
		"json",
		z.object({
			email: z.string().email().toLowerCase(),
			user_type: z.enum(["admin", "member"]).default("member"),
			access_types: z.array(z.enum(["inbox", "api", "tester"])).default(["inbox"]),
		}),
	),
	async (c) => {
		const { email, user_type, access_types: reqAccessTypes } = c.req.valid("json");

		const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(email).first();
		if (existing) return c.json({ error: "already_exists" }, 409);

		let access_types = reqAccessTypes ?? [];
		if (user_type === "admin") {
			access_types = ["inbox", "api", "tester"];
		}

		const rawToken = generateId() + generateId();
		const tokenHash = await sha256Hex(rawToken);
		const id = generateId();
		const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
		const createdBy = c.get("userId");

		await c.env.DB.prepare(
			"INSERT INTO invites (id, email, token_hash, created_by, expires_at, user_type, access_types, used, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)",
		)
			.bind(
				id,
				email,
				tokenHash,
				createdBy,
				expiresAt,
				user_type,
				JSON.stringify(access_types),
				new Date().toISOString(),
			)
			.run();

		const origin = (c.env.PUBLIC_URL || new URL(c.req.url).origin).replace(/\/$/, "");
		const inviteUrl = `${origin}/invite/${rawToken}`;
		const domain = await c.env.DB.prepare(
			"SELECT name FROM domains WHERE verified = 1 ORDER BY created_at ASC LIMIT 1",
		).first<{ name: string }>();
		let emailed = false;
		if (domain && c.env.CF_API_TOKEN && c.env.CF_ACCOUNT_ID) {
			try {
				await sendEmail(
					{
						from: { address: `noreply@${domain.name}`, name: "EmailFlare" },
						to: email,
						subject: "You're invited to EmailFlare",
						text: `Accept your invite: ${inviteUrl}\n\nThis link expires in 48 hours.`,
						html: `<p>You have been invited to an EmailFlare workspace.</p><p><a href="${inviteUrl}">Accept invite</a></p><p>This link expires in 48 hours.</p>`,
					},
					c.env.CF_API_TOKEN,
					c.env.CF_ACCOUNT_ID,
				);
				emailed = true;
			} catch {
				emailed = false;
			}
		}
		await writeAudit(c.env.DB, {
			actorId: createdBy,
			action: "invite.create",
			targetType: "invite",
			targetId: id,
			detail: email,
		});
		return c.json({ inviteUrl, emailed }, 201);
	},
);

// GET /api/invites/:token
app.get("/invites/:token", async (c) => {
	const rawToken = c.req.param("token");
	const tokenHash = await sha256Hex(rawToken);

	const invite = await c.env.DB.prepare(
		"SELECT id, email, expires_at, used FROM invites WHERE token_hash = ? LIMIT 1",
	)
		.bind(tokenHash)
		.first<{ id: string; email: string; expires_at: string; used: number }>();

	if (!invite) return c.json({ error: "invite_not_found" }, 404);
	if (invite.used) return c.json({ error: "invite_not_found" }, 404);
	if (new Date(invite.expires_at) < new Date()) return c.json({ error: "invite_expired" }, 410);

	return c.json({ email: invite.email });
});

const acceptSchema = z.object({
	name: z.string().min(1).max(100),
	password: z.string().min(8),
});

// POST /api/invites/:token/accept
app.post("/invites/:token/accept", zValidator("json", acceptSchema), async (c) => {
	const rawToken = c.req.param("token");
	const tokenHash = await sha256Hex(rawToken);

	const invite = await c.env.DB.prepare(
		"SELECT id, email, expires_at, used, user_type, access_types FROM invites WHERE token_hash = ? LIMIT 1",
	)
		.bind(tokenHash)
		.first<{
			id: string;
			email: string;
			expires_at: string;
			used: number;
			user_type: "admin" | "member";
			access_types?: string;
		}>();

	if (!invite) return c.json({ error: "invite_not_found" }, 404);
	if (invite.used) return c.json({ error: "invite_not_found" }, 404);
	if (new Date(invite.expires_at) < new Date()) return c.json({ error: "invite_expired" }, 410);

	const { name, password } = c.req.valid("json");
	const passwordHash = await hashPassword(password);
	const userId = generateId();
	const now = new Date().toISOString();

	const userType: "admin" | "member" = invite.user_type === "admin" ? "admin" : "member";

	let accessTypes: ("inbox" | "api" | "tester")[] = [];
	if (userType === "admin") {
		accessTypes = ["inbox", "api", "tester"];
	} else if (invite.access_types) {
		try {
			const parsed = JSON.parse(invite.access_types);
			accessTypes = Array.isArray(parsed) ? parsed : [];
		} catch {
			accessTypes = [];
		}
	}

	await c.env.DB.batch([
		c.env.DB.prepare(
			"INSERT INTO users (id, name, email, password_hash, user_type, access_types, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		).bind(userId, name, invite.email, passwordHash, userType, JSON.stringify(accessTypes), now),
		c.env.DB.prepare("UPDATE invites SET used = 1 WHERE id = ?").bind(invite.id),
	]);

	await saveSession(c, {
		userId,
		userType,
		accessTypes,
		name,
		email: invite.email,
	});
	return c.json({ ok: true }, 201);
});

export default app;
