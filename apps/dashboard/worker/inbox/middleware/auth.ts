import { SignJWT } from "jose";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { HonoEnv } from "../env.ts";
import {
	SESSION_ALG,
	SESSION_COOKIE,
	SESSION_TTL,
	sessionKey,
	verifySession,
	type AccessType,
	type SessionPayload,
	type UserType,
} from "../lib/session.ts";

export type { AccessType, SessionPayload, UserType };

/** Resolves the session from the cookie; see verifySession for what is checked. */
export async function getSession(c: Context<HonoEnv>): Promise<SessionPayload | null> {
	return verifySession(getCookie(c, SESSION_COOKIE), c.env);
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
		.setProtectedHeader({ alg: SESSION_ALG })
		.setIssuedAt()
		.setExpirationTime(`${SESSION_TTL}s`)
		.sign(sessionKey(c.env.SESSION_SECRET));

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

/**
 * Wrap a router so `guard` runs only for that router's own routes.
 *
 * Do not use `group.use("/*", guard)` on a sub-app mounted at "/": Hono applies
 * it to every route registered after it, so one group's guard (say requireAdmin)
 * silently blocks the groups mounted below it. Mount each guarded router at its
 * own prefix instead: `app.route("/keys", guarded(requireAdmin, keysRouter))`.
 */
export function guarded(guard: MiddlewareHandler<HonoEnv>, router: Hono<HonoEnv>): Hono<HonoEnv> {
	const wrapper = new Hono<HonoEnv>();
	wrapper.use("*", guard);
	wrapper.route("/", router);
	return wrapper;
}
