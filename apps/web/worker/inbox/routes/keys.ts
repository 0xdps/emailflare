import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { sha256Hex } from "../middleware/apiKey.ts";
import { makeDb } from "../db.ts";
import type { HonoEnv } from "../env.ts";
import { keyCreateSchema, generateId } from "@emailflare/email-core";

function randomHex(bytes: number): string {
	const arr = crypto.getRandomValues(new Uint8Array(bytes));
	return Array.from(arr)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

const app = new Hono<HonoEnv>();

// GET /api/keys
app.get("/", async (c) => {
	const { apiKeys } = makeDb(c.env.DB);
	const rows = await apiKeys.find({ orderBy: [{ column: "created_at", direction: "desc" }] });
	return c.json(rows.map(({ key_hash: _, ...r }) => r));
});

// POST /api/keys
app.post("/", zValidator("json", keyCreateSchema), async (c) => {
	const { name, type, scope, domainIds } = c.req.valid("json");
	const { apiKeys, apiKeyDomains } = makeDb(c.env.DB);

	const prefix = type === "test" ? "eftest_" : "eflive_";
	const rawKey = `${prefix}${randomHex(20)}`;
	const keyHash = await sha256Hex(rawKey);
	const keyPrefix = rawKey.slice(0, 14);

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

	if ((scope === "domain" || scope === "multi") && domainIds?.length) {
		await apiKeyDomains.insertMany(
			domainIds.map((domainId) => ({ api_key_id: row.id, domain_id: domainId })),
			{ onConflict: "ignore" },
		);
	}

	const { key_hash: _, ...safeRow } = row;
	return c.json({ ...safeRow, key: rawKey }, 201);
});

// DELETE /api/keys/:id  (revoke)
app.delete("/:id", async (c) => {
	const { apiKeys } = makeDb(c.env.DB);
	const row = await apiKeys.findOne({ where: { id: c.req.param("id") } });
	if (!row) return c.json({ error: "API key not found" }, 404);

	await apiKeys.update({ where: { id: row.id }, set: { active: 0 } });
	return c.json({ revoked: true });
});

export default app;
