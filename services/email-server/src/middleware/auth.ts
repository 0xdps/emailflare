import { sealData, unsealData } from "iron-session";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import { env } from "../env.js";

export interface SessionData {
	isLoggedIn: boolean;
}

const SESSION_COOKIE = "ef_session";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

const sessionOptions = {
	password: env.SESSION_SECRET,
	ttl: SESSION_TTL,
};

export async function getSession(c: Context): Promise<SessionData> {
	const sealed = getCookie(c, SESSION_COOKIE);
	if (!sealed) return { isLoggedIn: false };
	try {
		return await unsealData<SessionData>(sealed, sessionOptions);
	} catch {
		return { isLoggedIn: false };
	}
}

export async function saveSession(c: Context, data: SessionData): Promise<void> {
	const sealed = await sealData(data, sessionOptions);
	setCookie(c, SESSION_COOKIE, sealed, {
		httpOnly: true,
		secure: env.NODE_ENV === "production",
		sameSite: "Strict",
		path: "/",
		maxAge: SESSION_TTL,
	});
}

export function clearSession(c: Context): void {
	deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export const requireAdminToken = createMiddleware(async (c, next) => {
	const session = await getSession(c);
	if (!session.isLoggedIn) throw new HTTPException(401, { message: "Unauthorized" });
	await next();
});
