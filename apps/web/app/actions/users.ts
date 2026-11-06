"use server";

import { env } from "cloudflare:workers";
import { generateId } from "@emailflare/email-core";
import { requireAdmin, requireSuperAdmin } from "./auth";
import type { Env } from "@/worker/inbox/env";

async function sha256Hex(input: string): Promise<string> {
	const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export async function createInviteAction(
	email: string,
	role: "admin" | "member" | "tester" = "member",
): Promise<{ inviteUrl: string }> {
	const session = await requireAdmin();
	const workerEnv = env as unknown as Env;

	const normalizedEmail = email.trim().toLowerCase();
	// Non-super-admins can only invite members
	const targetRole = session.role === "super-admin" ? role : "member";

	const existing = await workerEnv.DB.prepare("SELECT id FROM users WHERE email = ? LIMIT 1")
		.bind(normalizedEmail)
		.first();
	if (existing) {
		throw new Error("already_exists");
	}

	const rawToken = generateId() + generateId();
	const tokenHash = await sha256Hex(rawToken);
	const id = generateId();
	const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
	const now = new Date().toISOString();

	await workerEnv.DB.prepare(
		"INSERT INTO invites (id, email, token_hash, created_by, role, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(id, normalizedEmail, tokenHash, session.userId, targetRole, expiresAt, now)
		.run();

	const publicOrigin = (workerEnv.PUBLIC_URL ?? "").replace(/\/$/, "");
	const inviteUrl = `${publicOrigin}/invite/${rawToken}`;

	return { inviteUrl };
}

export async function revokeUserAction(id: string): Promise<{ deleted: boolean }> {
	const session = await requireSuperAdmin();
	const workerEnv = env as unknown as Env;

	if (id === session.userId) {
		throw new Error("Cannot delete own account");
	}

	const user = await workerEnv.DB.prepare("SELECT id, role FROM users WHERE id = ? LIMIT 1")
		.bind(id)
		.first<{ id: string; role: string }>();
	if (!user) {
		throw new Error("User not found");
	}
	if (user.role === "super-admin") {
		throw new Error("Cannot delete the owner account");
	}

	await workerEnv.DB.batch([
		workerEnv.DB.prepare("DELETE FROM inbox_members WHERE user_id = ?").bind(id),
		workerEnv.DB.prepare("DELETE FROM push_subscriptions WHERE user_id = ?").bind(id),
		workerEnv.DB.prepare("DELETE FROM users WHERE id = ?").bind(id),
	]);

	return { deleted: true };
}

export async function changeUserRoleAction(
	id: string,
	role: "admin" | "member" | "tester",
): Promise<{ updated: boolean }> {
	const session = await requireSuperAdmin();
	const workerEnv = env as unknown as Env;

	if (id === session.userId) {
		throw new Error("Cannot change own role");
	}

	const user = await workerEnv.DB.prepare("SELECT id, role FROM users WHERE id = ? LIMIT 1")
		.bind(id)
		.first<{ id: string; role: string }>();
	if (!user) {
		throw new Error("User not found");
	}
	if (user.role === "super-admin") {
		throw new Error("Cannot change the owner role");
	}

	await workerEnv.DB.prepare("UPDATE users SET role = ? WHERE id = ?").bind(role, id).run();

	return { updated: true };
}
