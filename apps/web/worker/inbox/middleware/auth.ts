// Cookie-based session for inbox: email+password auth.
// Fresh permissions are resolved from the database on every authenticated request.

import { SignJWT, jwtVerify } from "jose";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { HonoEnv } from "../env.ts";

export type UserType = "admin" | "member";
export type AccessType = "inbox" | "api" | "tester";

export interface SessionPayload {
	userId: string;
	userType: UserType;
	accessTypes: AccessType[];
	name: string;
	email: string;
}

const SESSION_COOKIE = "ef_inbox_session";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days
const ALG = "HS256";

function secretKey(secret: string): Uint8Array {
	return new TextEncoder().encode(secret);
}

function parseAccessTypes(raw?: string | null): AccessType[] {
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

/**
 * Resolves session from cookie, then fetches the fresh user row from DB
 * so demotions and capability revocations take effect immediately.
 */
export async function getSession(c: Context<HonoEnv>): Promise<SessionPayload | null> {
	const token = getCookie(c, SESSION_COOKIE);
	if (!token) return null;
	try {
		const { payload } = await jwtVerify(token, secretKey(c.env.SESSION_SECRET));
		const userId = payload["userId"];
		if (typeof userId !== "string" || !userId) {
			return null;
		}

		// Always re-read the user from DB on each request
		const user = await c.env.DB.prepare(
			"SELECT id, name, email, user_type, access_types FROM users WHERE id = ? LIMIT 1",
		)
			.bind(userId)
			.first<{
				id: string;
				name: string;
				email: string;
				user_type: "admin" | "member";
				access_types: string;
			}>();

		if (!user) return null;

		const userType: UserType = user.user_type === "admin" ? "admin" : "member";
		// Admin automatically has all capabilities; for members, let the set be the set (no forcing inbox).
		const accessTypes: AccessType[] =
			userType === "admin" ? ["inbox", "api", "tester"] : parseAccessTypes(user.access_types);

		return {
			userId: user.id,
			userType,
			accessTypes,
			name: user.name,
			email: user.email,
		};
	} catch {
		return null;
	}
}

export async function saveSession(c: Context<HonoEnv>, data: SessionPayload): Promise<void> {
	const userType: UserType = data.userType === "admin" ? "admin" : "member";
	const accessTypes = userType === "admin" ? ["inbox", "api", "tester"] : data.accessTypes;

	const token = await new SignJWT({
		userId: data.userId,
		userType,
		accessTypes,
		name: data.name,
		email: data.email,
	})
		.setProtectedHeader({ alg: ALG })
		.setIssuedAt()
		.setExpirationTime(`${SESSION_TTL}s`)
		.sign(secretKey(c.env.SESSION_SECRET));

	const hostname = new URL(c.req.url).hostname;
	const isLocalDev = hostname === "localhost" || hostname === "127.0.0.1";

	setCookie(c, SESSION_COOKIE, token, {
		httpOnly: true,
		secure: !isLocalDev,
		sameSite: "Lax",
		path: "/",
		maxAge: SESSION_TTL,
	});
}

export function clearSession(c: Context<HonoEnv>): void {
	deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

/** Middleware: require valid session, set userId + userType + accessTypes on context. */
export const requireSession = createMiddleware<HonoEnv>(async (c, next) => {
	const session = await getSession(c);
	if (!session) throw new HTTPException(401, { message: "Unauthorized" });
	c.set("userId", session.userId);
	c.set("userType", session.userType);
	c.set("accessTypes", session.accessTypes);
	await next();
});

/** Middleware: require admin authority. */
export const requireAdmin = createMiddleware<HonoEnv>(async (c, next) => {
	const userType = c.get("userType");
	if (userType !== "admin") {
		throw new HTTPException(403, { message: "Forbidden: Admin access required" });
	}
	await next();
});

/** Middleware: require specific product access capability. */
export const requireAccess = (type: AccessType) =>
	createMiddleware<HonoEnv>(async (c, next) => {
		const userType = c.get("userType");
		const accessTypes = c.get("accessTypes") ?? [];
		if (userType === "admin" || accessTypes.includes(type)) {
			return await next();
		}
		throw new HTTPException(403, { message: `Forbidden: '${type}' access required` });
	});

/** Middleware: require API access. */
export const requireApi = requireAccess("api");

/** Middleware: require tester access (Test Mailbox access). */
export const requireTester = requireAccess("tester");

/** Middleware: require Inbox access. */
export const requireInbox = requireAccess("inbox");
