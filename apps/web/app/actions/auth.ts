import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { env } from "cloudflare:workers";
import type { Env } from "@/worker/inbox/env";
import type { SessionPayload, UserType, AccessType } from "@/worker/inbox/middleware/auth";

export const SESSION_COOKIE = "ef_inbox_session";

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
 * Reads and verifies the current session from cookies in a Server Action or RSC,
 * re-querying the database to get fresh permissions on every request.
 */
export async function getServerSession(): Promise<SessionPayload | null> {
	const cookieStore = await cookies();
	const token = cookieStore.get(SESSION_COOKIE)?.value;
	if (!token) return null;

	const workerEnv = env as unknown as Env;
	if (!workerEnv?.SESSION_SECRET || !workerEnv?.DB) return null;

	try {
		const { payload } = await jwtVerify(token, secretKey(workerEnv.SESSION_SECRET));
		const userId = payload["userId"];
		if (typeof userId !== "string" || !userId) {
			return null;
		}

		// Re-read fresh user record from DB
		const user = await workerEnv.DB.prepare(
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
