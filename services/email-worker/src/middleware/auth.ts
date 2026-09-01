// Cookie-based session using jose SignJWT (HS256).
// No Node.js crypto — uses Web Crypto API via jose.

import { SignJWT, jwtVerify } from "jose";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { HonoEnv } from "../env.ts";

export interface SessionData {
	isLoggedIn: boolean;
}

const SESSION_COOKIE = "ef_session";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days in seconds
const ALG = "HS256";

function secretKey(secret: string): Uint8Array {
	return new TextEncoder().encode(secret);
}

export async function getSession(c: Context<HonoEnv>): Promise<SessionData> {
	const token = getCookie(c, SESSION_COOKIE);
	if (!token) return { isLoggedIn: false };
	try {
		const { payload } = await jwtVerify(token, secretKey(c.env.SESSION_SECRET));
		return { isLoggedIn: Boolean(payload["isLoggedIn"]) };
	} catch {
		return { isLoggedIn: false };
	}
}

export async function saveSession(c: Context<HonoEnv>, data: SessionData): Promise<void> {
	const token = await new SignJWT({ isLoggedIn: data.isLoggedIn })
		.setProtectedHeader({ alg: ALG })
		.setIssuedAt()
		.setExpirationTime(`${SESSION_TTL}s`)
		.sign(secretKey(c.env.SESSION_SECRET));

	const isLocalDev = new URL(c.req.url).hostname === "localhost";

	setCookie(c, SESSION_COOKIE, token, {
		httpOnly: true,
		secure: !isLocalDev,
		sameSite: "Strict",
		path: "/",
		maxAge: SESSION_TTL,
	});
}

export function clearSession(c: Context<HonoEnv>): void {
	deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export const requireAdminToken = createMiddleware<HonoEnv>(async (c, next) => {
	const session = await getSession(c);
	if (!session.isLoggedIn) throw new HTTPException(401, { message: "Unauthorized" });
	await next();
});
