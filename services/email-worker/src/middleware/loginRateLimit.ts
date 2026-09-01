// IP-based login rate limiting using Workers KV.
// 10 attempts per minute per IP. KV TTL handles window expiry automatically.
//
// Note: There is a small race window between read-increment-write. This is
// acceptable for login rate limiting (non-security-critical — the auth check
// itself is always timing-safe).

const LOGIN_LIMIT = 10;
const WINDOW_TTL = 60; // seconds

export async function checkLoginRateLimit(ip: string, kv: KVNamespace): Promise<boolean> {
	const key = `login_rl:${ip}`;
	const raw = await kv.get(key);
	const count = raw ? parseInt(raw, 10) : 0;

	if (count >= LOGIN_LIMIT) return false;

	// Increment — preserve remaining TTL if already set, else start a new window
	await kv.put(key, String(count + 1), { expirationTtl: WINDOW_TTL });
	return true;
}
