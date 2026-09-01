import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createHash, randomBytes } from "node:crypto";
import { apiKeys, apiKeyDomains } from "../db.js";
import { keyCreateSchema, generateId } from "@emailflare/email-core";

const app = new Hono();

// GET /api/keys
app.get("/", async (c) => {
	const rows = await apiKeys.find({ orderBy: [{ column: "created_at", direction: "desc" }] });
	// Never expose hashes
	return c.json(rows.map(({ key_hash: _, ...r }) => r));
});

// POST /api/keys
app.post("/", zValidator("json", keyCreateSchema), async (c) => {
	const { name, type, scope, domainIds } = c.req.valid("json");

	// Generate key: eftest_<40 hex> or eflive_<40 hex>
	const prefix = type === "test" ? "eftest_" : "eflive_";
	const rawKey = `${prefix}${randomBytes(20).toString("hex")}`;
	const keyHash = createHash("sha256").update(rawKey).digest("hex");
	const keyPrefix = rawKey.slice(0, 14); // "eftest_" or "eflive_" (7) + first 7 hex chars

	const row = await apiKeys.insert({
		id: generateId(),
		name,
		key_hash: keyHash,
		key_prefix: keyPrefix,
		scope,
		key_type: type,
		active: 1,
		last_used_at: null,
		send_count: 0,
		created_at: new Date().toISOString(),
	});

	// Store domain associations for domain/multi scope
	if ((scope === "domain" || scope === "multi") && domainIds?.length) {
		await apiKeyDomains.insertMany(
			domainIds.map((domainId) => ({ api_key_id: row.id, domain_id: domainId })),
			{ onConflict: "ignore" },
		);
	}

	const { key_hash: _, ...safeRow } = row;
	return c.json({ ...safeRow, key: rawKey }, 201); // Plaintext key shown ONCE
});

// DELETE /api/keys/:id  (revoke)
app.delete("/:id", async (c) => {
	const row = await apiKeys.findOne({ where: { id: c.req.param("id") } });
	if (!row) return c.json({ error: "API key not found" }, 404);

	await apiKeys.update({ where: { id: row.id }, set: { active: 0 } });
	return c.json({ revoked: true });
});

export default app;
