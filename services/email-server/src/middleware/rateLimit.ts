/**
 * In-memory sliding-window rate limiter keyed by API key ID.
 * Resets on container restart — acceptable for a single-instance deployment.
 * 100 requests / minute per key by default.
 */

const RATE_LIMIT = 100; // max requests per window
const WINDOW_MS = 60_000; // 1 minute

interface Entry {
	count: number;
	resetAt: number;
}

const store = new Map<string, Entry>();

// Sweep expired entries periodically to prevent unbounded memory growth.
setInterval(() => {
	const now = Date.now();
	for (const [key, entry] of store) {
		if (now >= entry.resetAt) store.delete(key);
	}
}, WINDOW_MS);

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetAt: number; // epoch ms
	limit: number;
}

export function checkRateLimit(keyId: string): RateLimitResult {
	const now = Date.now();
	let entry = store.get(keyId);

	if (!entry || now >= entry.resetAt) {
		entry = { count: 1, resetAt: now + WINDOW_MS };
		store.set(keyId, entry);
		return { allowed: true, remaining: RATE_LIMIT - 1, resetAt: entry.resetAt, limit: RATE_LIMIT };
	}

	if (entry.count >= RATE_LIMIT) {
		return { allowed: false, remaining: 0, resetAt: entry.resetAt, limit: RATE_LIMIT };
	}

	entry.count++;
	return { allowed: true, remaining: RATE_LIMIT - entry.count, resetAt: entry.resetAt, limit: RATE_LIMIT };
}
