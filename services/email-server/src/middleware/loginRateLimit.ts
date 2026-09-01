/**
 * IP-based rate limiter for the login endpoint.
 * 10 attempts per minute per IP address to prevent brute-force.
 */

const LOGIN_LIMIT = 10;
const WINDOW_MS = 60_000; // 1 minute

interface Entry {
	count: number;
	resetAt: number;
}

const store = new Map<string, Entry>();

// Sweep expired entries periodically to avoid memory growth.
setInterval(() => {
	const now = Date.now();
	for (const [ip, entry] of store) {
		if (now >= entry.resetAt) store.delete(ip);
	}
}, WINDOW_MS);

export function checkLoginRateLimit(ip: string): boolean {
	const now = Date.now();
	let entry = store.get(ip);

	if (!entry || now >= entry.resetAt) {
		store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
		return true;
	}

	if (entry.count >= LOGIN_LIMIT) return false;

	entry.count++;
	return true;
}
