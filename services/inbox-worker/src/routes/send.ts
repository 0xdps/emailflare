// POST /v1/send
//
// Test API keys are captured into the in-house Test Mailbox (html_body/text_body)
// instead of delivering via Cloudflare.

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { makeDb, D1Db } from "../db.ts";
import { sendEmail } from "../services/cloudflare.ts";
import { renderLayout } from "../emails.ts";
import type { LayoutName } from "../emails.ts";
import type { HonoEnv, ApiKeyContext } from "../env.ts";
import { executeSend, generateId, sendSchema } from "@emailflare/email-core";

const app = new Hono<HonoEnv>();

app.post("/", zValidator("json", sendSchema), async (c) => {
	const body = c.req.valid("json");
	const apiKey = c.get("apiKey") as ApiKeyContext;
	const { templates, emailLogs } = makeDb(c.env.DB);
	const db = new D1Db(c.env.DB);

	const result = await executeSend(
		{
			db,
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
					: sendEmail(msg, c.env.CF_API_TOKEN, c.env.CF_ACCOUNT_ID),
			insertLog: (row) => emailLogs.insert(row),
		},
		{
			body,
			apiKey,
			idempotencyKey: c.req.header("Idempotency-Key") ?? null,
			publicOrigin: c.env.PUBLIC_URL ?? "",
		},
	);

	return c.json(result.body, result.status);
});

export default app;
