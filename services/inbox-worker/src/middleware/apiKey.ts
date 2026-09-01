// API key validation middleware using Web Crypto SHA-256.
// Compatible with hashes produced by the Node.js backend's sha256.

import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { makeDb } from "../db.ts";
import type { HonoEnv } from "../env.ts";

export async function sha256Hex(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const buf = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export const requireApiKey = createMiddleware<HonoEnv>(async (c, next) => {
	const authHeader = c.req.header("Authorization");
	const raw = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

	if (!raw) throw new HTTPException(401, { message: "Missing API key" });

	const hash = await sha256Hex(raw);
	const { apiKeys, apiKeyDomains } = makeDb(c.env.DB);
	const key = await apiKeys.findOne({ where: { key_hash: hash, active: 1 } });

	if (!key) throw new HTTPException(401, { message: "Invalid or revoked API key" });

	let allowedDomainIds: string[] = [];
	if (key.scope !== "global") {
		const rows = await apiKeyDomains.find({ where: { api_key_id: key.id } });
		allowedDomainIds = rows.map((r) => r.domain_id);
	}

	c.set("apiKey", {
		keyId: key.id,
		scope: key.scope,
		allowedDomainIds,
		isTest: key.key_type === "test",
	});
	await next();
});
