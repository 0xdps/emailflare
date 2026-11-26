import { cookies } from "next/headers";
import { env } from "cloudflare:workers";
import type { Env } from "@/worker/inbox/env";
import { SESSION_COOKIE, verifySession } from "@/worker/inbox/lib/session";
import type { SessionPayload, AccessType } from "@/worker/inbox/lib/session";

export { SESSION_COOKIE };

/**
 * Reads and verifies the current session from cookies in a Server Action or RSC.
 * Shares its implementation with the API, including revocation.
 */
export async function getServerSession(): Promise<SessionPayload | null> {
	const cookieStore = await cookies();
	return verifySession(cookieStore.get(SESSION_COOKIE)?.value, env as unknown as Env);
}

/**
 * Requires an authenticated user session, throwing an error if absent.
 */
export async function requireSession(): Promise<SessionPayload> {
	const session = await getServerSession();
	if (!session) {
		throw new Error("Unauthorized");
	}
	return session;
}

/**
 * Requires an admin session.
 */
export async function requireAdmin(): Promise<SessionPayload> {
	const session = await requireSession();
	if (session.userType !== "admin") {
		throw new Error("Forbidden: Admin access required");
	}
	return session;
}

/**
 * Requires a specific access type.
 */
export async function requireAccess(type: AccessType): Promise<SessionPayload> {
	const session = await requireSession();
	if (session.userType === "admin" || session.accessTypes.includes(type)) {
		return session;
	}
	throw new Error(`Forbidden: '${type}' access required`);
}

/**
 * Requires tester access.
 */
export async function requireTester(): Promise<SessionPayload> {
	return requireAccess("tester");
}

/**
 * Requires API access.
 */
export async function requireApi(): Promise<SessionPayload> {
	return requireAccess("api");
}

/**
 * Requires Inbox access.
 */
export async function requireInbox(): Promise<SessionPayload> {
	return requireAccess("inbox");
}
