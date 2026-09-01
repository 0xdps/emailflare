import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { generateId } from "@emailflare/email-core";
import { sha256Hex } from "../middleware/apiKey.js";
import { makeDb } from "../db.js";
import type { HonoEnv } from "../env.js";

function randomHex(bytes: number): string {
	const arr = crypto.getRandomValues(new Uint8Array(bytes));
	return Array.from(arr)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

const app = new Hono<HonoEnv>();

app.get("/", async (c) => {
	const { apiKeys } = makeDb();
	const rows = await apiKeys.find({ orderBy: [{ column: "created_at", direction: "desc" }] });
	return c.json(rows.map(({ key_hash: _, ...r }) => r));
});

const createSchema = z.object({
	name: z.string().min(1),
	type: z.enum(["test", "live"]).default("live"),
	scope: z.enum(["global", "domain", "multi"]).default("global"),
	domainIds: z.array(z.string()).optional(),
});

app.post("/", zValidator("json", createSchema), async (c) => {
	const { name, type, scope, domainIds } = c.req.valid("json");
	const { apiKeys, apiKeyDomains } = makeDb();

	const prefix = type === "test" ? "eftest_" : "eflive_";
	const rawKey = `${prefix}${randomHex(20)}`;
	const keyHash = await sha256Hex(rawKey);

	const row = await apiKeys.insert({
		id: generateId(),
		name,
		key_hash: keyHash,
		key_prefix: rawKey.slice(0, 14),
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

app.delete("/:id", async (c) => {
	const { apiKeys } = makeDb();
	const row = await apiKeys.findOne({ where: { id: c.req.param("id") } });
	if (!row) return c.json({ error: "API key not found" }, 404);
	await apiKeys.update({ where: { id: row.id }, set: { active: 0 } });
	return c.json({ revoked: true });
});

export default app;
