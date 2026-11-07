// Playground routes (session authenticated)
// POST /api/playground/send — send a test or live email from the Playground interface

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { makeDb, D1Db } from "../db.ts";
import { renderLayout } from "../emails.ts";
import type { LayoutName } from "../emails.ts";
import type { HonoEnv } from "../env.ts";
import { generateId, sendWithLog, resolveDomainId, applyVariables, executeSend } from "@emailflare/email-core";
import { sendEmail } from "../services/cloudflare.ts";
import { sha256Hex } from "../middleware/apiKey.ts";

const playgroundSendSchema = z.object({
	from: z.string().min(1),
	fromName: z.string().optional(),
	to: z.string().email(),
	subject: z.string().optional(),
	templateId: z.string().optional(),
	templateSlug: z.string().optional(),
	variables: z.record(z.unknown()).optional(),
	themeId: z.string().optional(),
	mode: z.enum(["test", "live"]).default("test"),
	apiKey: z.string().optional(),
});

const app = new Hono<HonoEnv>();

app.post("/send", zValidator("json", playgroundSendSchema), async (c) => {
	const body = c.req.valid("json");
	const { templates, emailLogs, apiKeys, apiKeyDomains } = makeDb(c.env.DB);
	const db = new D1Db(c.env.DB);

	let template = null;
	if (body.templateSlug) {
		template = await templates.findOne({ where: { slug: body.templateSlug } });
	} else if (body.templateId) {
		template = await templates.findOne({ where: { id: body.templateId } });
	}

	const vars = body.variables ?? {};
	let resolvedSubject = body.subject ?? template?.subject ?? "";
	resolvedSubject = applyVariables(resolvedSubject, vars);

	let resolvedHtml = "";
	let resolvedText: string | undefined = undefined;

	if (template) {
		if (template.layout) {
			resolvedHtml = await renderLayout(template.layout as LayoutName, vars, body.themeId);
		} else {
			resolvedHtml = applyVariables(template.html_body, vars);
			resolvedText = template.text_body ? applyVariables(template.text_body, vars) : undefined;
		}
	} else {
		resolvedHtml = `<p>${resolvedSubject}</p>`;
	}

	if (body.mode === "test") {
		// Sandbox send: store directly in email_logs with is_test = 1, html_body, and text_body
		const out = await sendWithLog(
			{
				deliver: () => Promise.resolve({ id: `test_${generateId()}` }),
				resolveDomainId: (addr) => resolveDomainId(db, addr),
				insertLog: (row) => emailLogs.insert(row),
				templateId: template?.id ?? null,
				isTest: true,
				storeBodies: true,
			},
			{
				from: body.fromName ? { address: body.from, name: body.fromName } : body.from,
				to: body.to,
				subject: resolvedSubject,
				html: resolvedHtml,
				text: resolvedText,
			},
		);

		if (out.error) {
			return c.json({ ok: false, error: out.error }, 400);
		}

		return c.json({ ok: true, isTest: true, messageId: out.cfId });
	} else {
		// Live mode send: requires API key
		if (!body.apiKey) {
			return c.json({ ok: false, error: "An API key is required for live delivery." }, 400);
		}

		const hash = await sha256Hex(body.apiKey);
		const keyRecord = await apiKeys.findOne({ where: { key_hash: hash, active: 1 } });
		if (!keyRecord) {
			return c.json({ ok: false, error: "Invalid or inactive API key provided." }, 401);
		}

		let allowedDomainIds: string[] = [];
		if (keyRecord.scope !== "global") {
			const rows = await apiKeyDomains.find({ where: { api_key_id: keyRecord.id } });
			allowedDomainIds = rows.map((r) => r.domain_id);
		}

		const isTestKey = keyRecord.key_type === "test" || body.apiKey.startsWith("eftest_");

		const result = await executeSend(
			{
				db,
				findTemplate: async () => template,
				renderLayout: (layout, v, th) => renderLayout(layout as LayoutName, v, th),
				findIdempotentLog: async () => null,
				deliver: (msg) =>
					isTestKey
						? Promise.resolve({ id: generateId() })
						: sendEmail(msg, c.env.CF_API_TOKEN, c.env.CF_ACCOUNT_ID),
				insertLog: (row) => emailLogs.insert(row),
			},
			{
				body: {
					from: body.from,
					fromName: body.fromName,
					to: body.to,
					subject: body.subject,
					templateId: body.templateId,
					templateSlug: body.templateSlug,
					variables: body.variables,
					themeId: body.themeId,
				},
				apiKey: {
					keyId: keyRecord.id,
					scope: keyRecord.scope,
					allowedDomainIds,
					isTest: isTestKey,
				},
				idempotencyKey: null,
				publicOrigin: c.env.PUBLIC_URL ?? "",
			},
		);

		return c.json(result.body, result.status);
	}
});

export default app;
