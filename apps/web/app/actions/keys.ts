"use server";

import { env } from "cloudflare:workers";
import { generateId, keyCreateSchema } from "@emailflare/email-core";
import { makeDb } from "@/worker/inbox/db";
import { sha256Hex } from "@/worker/inbox/middleware/apiKey";
import { requireSession } from "./auth";
import type { Env } from "@/worker/inbox/env";

export interface ApiKey {
	id: string;
	name: string;
	key_prefix: string;
	key_type: "test" | "live";
	scope: "global" | "domain" | "multi";
	active: number;
	last_used_at: string | null;
	send_count: number;
	created_at: string;
}

export interface CreatedApiKey extends ApiKey {
	key: string;
}

function randomHex(bytes: number): string {
	const arr = crypto.getRandomValues(new Uint8Array(bytes));
	return Array.from(arr)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export async function createApiKeyAction(input: {
	name: string;
	type: "live" | "test";
	scope: "global" | "domain" | "multi";
	domainIds?: string[];
}): Promise<CreatedApiKey> {
	await requireSession();
	const validated = keyCreateSchema.parse(input);

	const workerEnv = env as unknown as Env;
	const { apiKeys, apiKeyDomains } = makeDb(workerEnv.DB);

	const prefix = validated.type === "test" ? "eftest_" : "eflive_";
	const rawKey = `${prefix}${randomHex(20)}`;
	const keyHash = await sha256Hex(rawKey);
	const keyPrefix = rawKey.slice(0, 14);

	const row = await apiKeys.insert({
		id: generateId(),
		name: validated.name,
		key_hash: keyHash,
		key_prefix: keyPrefix,
		scope: validated.scope,
		key_type: validated.type,
		active: 1,
		last_used_at: null,
		send_count: 0,
		created_at: new Date().toISOString(),
	});

	if ((validated.scope === "domain" || validated.scope === "multi") && validated.domainIds?.length) {
		await apiKeyDomains.insertMany(
			validated.domainIds.map((domainId) => ({ api_key_id: row.id, domain_id: domainId })),
			{ onConflict: "ignore" },
		);
	}

	const { key_hash: _, ...safeRow } = row;
	return {
		id: safeRow.id,
		name: safeRow.name,
		key_prefix: safeRow.key_prefix,
		scope: safeRow.scope,
		key_type: safeRow.key_type as "live" | "test",
		active: safeRow.active,
		last_used_at: safeRow.last_used_at,
		send_count: safeRow.send_count,
		created_at: safeRow.created_at,
		key: rawKey,
	};
}

export async function revokeApiKeyAction(id: string): Promise<{ revoked: boolean }> {
	await requireSession();
	const workerEnv = env as unknown as Env;
	const { apiKeys } = makeDb(workerEnv.DB);

	const row = await apiKeys.findOne({ where: { id } });
	if (!row) throw new Error("API key not found");

	await apiKeys.update({ where: { id: row.id }, set: { active: 0 } });
	return { revoked: true };
}
