// API-key rate limiting via the Workers Rate Limiting binding.
// 100 requests per 60 seconds per key.
//
// If the RATE_LIMITER binding is absent (e.g. Free plan or local dev without
// the binding configured), the middleware falls back to allowing the request.

import { createMiddleware } from "hono/factory";
import type { HonoEnv, ApiKeyContext } from "../env.ts";

export const checkRateLimit = createMiddleware<HonoEnv>(async (c, next) => {
	const apiKey = c.get("apiKey") as ApiKeyContext;

	try {
		const rl = c.env.RATE_LIMITER;
		if (rl) {
			const { success } = await rl.limit({ key: apiKey.keyId });
			if (!success) {
				return c.json({ error: "Rate limit exceeded" }, 429);
			}
		}
	} catch {
		// Binding not available — allow request (local dev without ratelimit binding)
	}

	await next();
});
