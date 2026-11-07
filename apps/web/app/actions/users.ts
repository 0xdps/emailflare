"use server";

import { env } from "cloudflare:workers";
import { generateId } from "@emailflare/email-core";
import { requireAdmin } from "./auth";
import type { Env } from "@/worker/inbox/env";

async function sha256Hex(input: string): Promise<string> {
	const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export async function createInviteAction(
	email: string,
	user_type: "admin" | "member" = "member",
	accessTypes: ("inbox" | "api" | "tester")[] = ["inbox"],
): Promise<{ inviteUrl: string }> {
	const session = await requireAdmin();
	const workerEnv = env as unknown as Env;

	const normalizedEmail = email.trim().toLowerCase();
	let finalAccessTypes = [...accessTypes];
	if (user_type === "admin") {
		finalAccessTypes = ["inbox", "api", "tester"];
	}

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
		"INSERT INTO invites (id, email, token_hash, created_by, user_type, access_types, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(
			id,
			normalizedEmail,
			tokenHash,
			session.userId,
			user_type,
			JSON.stringify(finalAccessTypes),
			expiresAt,
			now,
		)
		.run();

	const publicOrigin = (workerEnv.PUBLIC_URL ?? "").replace(/\/$/, "");
	const inviteUrl = `${publicOrigin}/invite/${rawToken}`;

	return { inviteUrl };
}

export async function revokeUserAction(id: string): Promise<{ deleted: boolean }> {
	const session = await requireAdmin();
	const workerEnv = env as unknown as Env;

	if (id === session.userId) {
		throw new Error("Cannot delete own account");
	}

	const user = await workerEnv.DB.prepare("SELECT id, user_type FROM users WHERE id = ? LIMIT 1")
		.bind(id)
		.first<{ id: string; user_type?: string }>();
	if (!user) {
		throw new Error("User not found");
	}

	const isAdmin = user.user_type === "admin";
	const adminCount = await workerEnv.DB.prepare(
		"SELECT COUNT(*) as count FROM users WHERE user_type = 'admin'",
	).first<{ count: number }>();

	if (isAdmin && (adminCount?.count ?? 0) <= 1) {
		throw new Error("Cannot delete the sole admin account");
	}

	await workerEnv.DB.batch([
		workerEnv.DB.prepare("DELETE FROM inbox_members WHERE user_id = ?").bind(id),
		workerEnv.DB.prepare("DELETE FROM push_subscriptions WHERE user_id = ?").bind(id),
		workerEnv.DB.prepare("DELETE FROM users WHERE id = ?").bind(id),
	]);

	return { deleted: true };
}

export async function changeUserPermissionsAction(
	id: string,
	user_type: "admin" | "member",
	access_types: ("inbox" | "api" | "tester")[],
): Promise<{ updated: boolean }> {
	const session = await requireAdmin();
	const workerEnv = env as unknown as Env;

	if (id === session.userId && user_type !== "admin") {
		throw new Error("Cannot demote your own admin account");
	}

	const user = await workerEnv.DB.prepare("SELECT id, user_type FROM users WHERE id = ? LIMIT 1")
		.bind(id)
		.first<{ id: string; user_type?: string }>();
	if (!user) {
		throw new Error("User not found");
	}

	if (user.user_type === "admin" && user_type !== "admin") {
		const adminCount = await workerEnv.DB.prepare(
			"SELECT COUNT(*) as count FROM users WHERE user_type = 'admin'",
		).first<{ count: number }>();
		if ((adminCount?.count ?? 0) <= 1) {
			throw new Error("Cannot demote the last remaining admin account");
		}
	}

	let finalAccess = [...access_types];
	if (user_type === "admin") {
		finalAccess = ["inbox", "api", "tester"];
	}

	await workerEnv.DB.prepare("UPDATE users SET user_type = ?, access_types = ? WHERE id = ?")
		.bind(user_type, JSON.stringify(finalAccess), id)
		.run();

	return { updated: true };
}
