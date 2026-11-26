// Session token verification shared by the Hono API and the Next.js server actions.
// One implementation so a change here (revocation, claims, TTL) applies everywhere.

import { jwtVerify } from "jose";

export type UserType = "admin" | "member";
export type AccessType = "inbox" | "api" | "tester";

export interface SessionPayload {
	userId: string;
	userType: UserType;
	accessTypes: AccessType[];
	name: string;
	email: string;
}

export const SESSION_COOKIE = "ef_inbox_session";
export const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days
export const SESSION_ALG = "HS256";

interface SessionEnv {
	SESSION_SECRET: string;
	DB: D1Database;
	RATE_LIMIT_KV: KVNamespace;
}

export function sessionKey(secret: string): Uint8Array {
	return new TextEncoder().encode(secret);
}

export function parseAccessTypes(raw?: string | null): AccessType[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) {
			return parsed.filter((t): t is AccessType => t === "inbox" || t === "api" || t === "tester");
		}
	} catch {
		// ignore
	}
	return [];
}

const epochKey = (userId: string) => `session_epoch:${userId}`;

/**
 * Invalidates every session issued to this user before now. Tokens are stateless, so this
 * records a cut-off instead: a token whose `iat` is older than the cut-off no longer verifies.
 */
export async function revokeSessions(kv: KVNamespace, userId: string): Promise<void> {
	await kv.put(epochKey(userId), String(Math.floor(Date.now() / 1000)), { expirationTtl: SESSION_TTL + 3600 });
}

/**
 * Verifies the token, then reads the user fresh from the database so demotions and deleted
 * accounts take effect immediately, and checks the user's revocation cut-off.
 */
export async function verifySession(token: string | undefined, env: SessionEnv): Promise<SessionPayload | null> {
	if (!token || !env?.SESSION_SECRET || !env?.DB) return null;
	try {
		const { payload } = await jwtVerify(token, sessionKey(env.SESSION_SECRET), { algorithms: [SESSION_ALG] });
		const userId = payload["userId"];
		if (typeof userId !== "string" || !userId) return null;

		const user = await env.DB.prepare(
			"SELECT id, name, email, user_type, access_types FROM users WHERE id = ? LIMIT 1",
		)
			.bind(userId)
			.first<{ id: string; name: string; email: string; user_type: string; access_types: string }>();
		if (!user) return null;

		const cutoff = Number(await env.RATE_LIMIT_KV.get(epochKey(user.id)));
		if (cutoff && (typeof payload.iat !== "number" || payload.iat < cutoff)) return null;

		const userType: UserType = user.user_type === "admin" ? "admin" : "member";
		return {
			userId: user.id,
			userType,
			// Admins hold every capability; members hold exactly the set they were granted.
			accessTypes: userType === "admin" ? ["inbox", "api", "tester"] : parseAccessTypes(user.access_types),
			name: user.name,
			email: user.email,
		};
	} catch {
		return null;
	}
}
