import { createHash } from "node:crypto";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { apiKeys, apiKeyDomains } from "../db.js";

export interface ApiKeyContext {
	keyId: string;
	scope: string;
	allowedDomainIds: string[];
	isTest: boolean;
}

export const requireApiKey = createMiddleware<{ Variables: { apiKey: ApiKeyContext } }>(async (c, next) => {
	const authHeader = c.req.header("Authorization");
	const raw = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

	if (!raw) throw new HTTPException(401, { message: "Missing API key" });

	const hash = createHash("sha256").update(raw).digest("hex");
	const key = await apiKeys.findOne({ where: { key_hash: hash, active: 1 } });

	if (!key) throw new HTTPException(401, { message: "Invalid or revoked API key" });

	let allowedDomainIds: string[] = [];
	if (key.scope !== "global") {
		const rows = await apiKeyDomains.find({ where: { api_key_id: key.id } });
		allowedDomainIds = rows.map((r) => r.domain_id);
	}

	c.set("apiKey", { keyId: key.id, scope: key.scope, allowedDomainIds, isTest: key.key_type === "test" });
	await next();
});
