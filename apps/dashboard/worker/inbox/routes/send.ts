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
import { executeSend, generateId, instrumentTracking, sendSchema } from "@/lib/core";
import { dispatchWebhooks } from "../lib/webhooks.ts";

const app = new Hono<HonoEnv>();

app.post("/", zValidator("json", sendSchema), async (c) => {
	const body = c.req.valid("json");
	const apiKey = c.get("apiKey") as ApiKeyContext;
	const { templates, emailLogs } = makeDb(c.env.DB);
	const db = new D1Db(c.env.DB);

	const sendAt = body.sendAt ? Date.parse(body.sendAt) : NaN;
	if (!apiKey.isTest && Number.isFinite(sendAt) && sendAt > Date.now() + 5_000) {
		const id = generateId();
		await c.env.DB.prepare(
			"INSERT INTO scheduled_sends (id, api_key_id, payload, idempotency_key, send_at, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
		)
			.bind(
				id,
				apiKey.keyId,
				JSON.stringify(body),
				c.req.header("Idempotency-Key") ?? null,
				new Date(sendAt).toISOString(),
				new Date().toISOString(),
			)
			.run();
		await c.env.EMAIL_QUEUE.send(
			{ type: "scheduled_send", id },
			{ delaySeconds: Math.ceil((sendAt - Date.now()) / 1000) },
		);
		return c.json({ scheduled: true, id, sendAt: new Date(sendAt).toISOString() }, 202);
	}

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
			insertLog: async (row) => {
				await emailLogs.insert(row);
				if (row.status === "sent" || row.status === "failed") {
					c.executionCtx.waitUntil(
						dispatchWebhooks(c.env, row.status === "sent" ? "email.sent" : "email.failed", {
							id: row.id,
							to: row.to_address,
							from: row.from_address,
							subject: row.subject,
						}),
					);
				}
			},
			prepareMessage: async (msg) => {
				if (!body.track || !msg.html) return msg;
				const origin = c.env.PUBLIC_URL ?? new URL(c.req.url).origin;
				const token = generateId();
				await c.env.DB.prepare(
					"INSERT INTO email_events (id, email_log_id, token, kind, url, created_at) VALUES (?, NULL, ?, 'issued', NULL, ?)",
				)
					.bind(generateId(), token, new Date().toISOString())
					.run();
				return { ...msg, html: instrumentTracking(msg.html, origin, token) };
			},
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
