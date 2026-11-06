import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { env } from "cloudflare:workers";
import type { Env } from "@/worker/inbox/env";
import type { SessionPayload } from "@/worker/inbox/middleware/auth";

export const SESSION_COOKIE = "ef_inbox_session";

function secretKey(secret: string): Uint8Array {
	return new TextEncoder().encode(secret);
}

/**
 * Reads and verifies the current session from cookies in a Server Action or RSC.
 */
export async function getServerSession(): Promise<SessionPayload | null> {
	const cookieStore = await cookies();
	const token = cookieStore.get(SESSION_COOKIE)?.value;
	if (!token) return null;

	const workerEnv = env as unknown as Env;
	if (!workerEnv?.SESSION_SECRET) return null;

	try {
		const { payload } = await jwtVerify(token, secretKey(workerEnv.SESSION_SECRET));
		if (
			typeof payload["userId"] !== "string" ||
			typeof payload["role"] !== "string" ||
			typeof payload["name"] !== "string" ||
			typeof payload["email"] !== "string"
		) {
			return null;
		}
		return {
			userId: payload["userId"] as string,
			role: payload["role"] as SessionPayload["role"],
			name: payload["name"] as string,
			email: payload["email"] as string,
		};
	} catch {
		return null;
	}
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
 * Requires an admin or super-admin session.
 */
export async function requireAdmin(): Promise<SessionPayload> {
	const session = await requireSession();
	if (session.role !== "admin" && session.role !== "super-admin") {
		throw new Error("Forbidden: Admin access required");
	}
	return session;
}

/**
 * Requires a super-admin session.
 */
export async function requireSuperAdmin(): Promise<SessionPayload> {
	const session = await requireSession();
	if (session.role !== "super-admin") {
		throw new Error("Forbidden: Super-admin access required");
	}
	return session;
}
