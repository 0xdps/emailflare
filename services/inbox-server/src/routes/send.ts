import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { executeSend, generateId, sendSchema } from "@emailflare/email-core";
import { makeDb, rawDb } from "../db.js";
import { sendEmail } from "../services/cloudflare.js";
import { renderLayout } from "@emailflare/emails";
import type { LayoutName } from "@emailflare/emails";
import { env } from "../env.js";
import type { HonoEnv, ApiKeyContext } from "../env.js";

const app = new Hono<HonoEnv>();

app.post("/", zValidator("json", sendSchema), async (c) => {
	const body = c.req.valid("json");
	const apiKey = c.get("apiKey") as ApiKeyContext;
	const { templates, emailLogs } = makeDb();

	const result = await executeSend(
		{
			db: rawDb,
			findTemplate: async (ref) => {
				if (ref.templateSlug) return templates.findOne({ where: { slug: ref.templateSlug } });
				if (ref.templateId) return templates.findOne({ where: { id: ref.templateId } });
				return null;
			},
			renderLayout: (layout, vars, themeId) => renderLayout(layout as LayoutName, vars, themeId),
			findIdempotentLog: async (idempotencyKey, apiKeyId) => {
				const existing = await emailLogs.findOne({
					where: { idempotency_key: idempotencyKey, api_key_id: apiKeyId },
				});
				if (!existing) return null;
				return { to_address: existing.to_address, cf_message_id: existing.cf_message_id };
			},
			deliver: (msg) =>
				apiKey.isTest
					? Promise.resolve({ id: generateId() })
					: sendEmail(msg, env.CF_API_TOKEN, env.CF_ACCOUNT_ID),
			insertLog: (row) => emailLogs.insert(row),
		},
		{
			body,
			apiKey,
			idempotencyKey: c.req.header("Idempotency-Key") ?? null,
			publicOrigin: env.PUBLIC_URL,
		},
	);

	return c.json(result.body, result.status);
});

export default app;
