import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db, emailLogs, templates, unsubscribeTokens } from "../db.js";
import { sendEmail } from "../services/cloudflare.js";
import { storeTestEmail } from "../services/testEmail.js";
import { renderLayout } from "@emailflare/emails";
import type { LayoutName } from "@emailflare/emails";
import { sendSchema, applyVariables, generateId, listUnsubscribeHeaders, sendWithLog } from "@emailflare/email-core";
import type { ApiKeyContext } from "../middleware/apiKey.js";
import { env } from "../env.js";

const app = new Hono();

/** Row shape returned by domain lookup queries. */
interface DomainRow {
	id: string;
}

// POST /v1/send
app.post("/", zValidator("json", sendSchema), async (c) => {
	const body = c.req.valid("json");
	const apiKey = c.get("apiKey" as never) as ApiKeyContext;
	const { isTest } = apiKey;

	// ── Idempotency check ─────────────────────────────────────────────────────
	const idempotencyKey = c.req.header("Idempotency-Key") ?? null;
	if (idempotencyKey) {
		const existing = await emailLogs.findOne({
			where: { idempotency_key: idempotencyKey, api_key_id: apiKey.keyId },
		});
		if (existing) {
			return c.json({
				cached: true,
				results: [{ to: existing.to_address, cfId: existing.cf_message_id ?? undefined }],
			});
		}
	}

	let html = body.html;
	let text = body.text;
	let subject = body.subject ?? "";
	let templateId: string | null = null;
	let domainId: string | null = null;

	// ── Resolve template ──────────────────────────────────────────────────────
	if (body.templateSlug || body.templateId) {
		const template = body.templateSlug
			? await templates.findOne({ where: { slug: body.templateSlug } })
			: await templates.findOne({ where: { id: body.templateId! } });
		if (!template) return c.json({ error: "Template not found" }, 404);

		const vars = (body.variables ?? {}) as Record<string, unknown>;
		subject = applyVariables(body.subject ?? template.subject, vars);

		if (template.layout) {
			html = await renderLayout(template.layout as LayoutName, vars, body.themeId);
		} else {
			html = applyVariables(template.html_body, vars);
			text = template.text_body ? applyVariables(template.text_body, vars) : undefined;
		}
		templateId = template.id;
		domainId = template.domain_id;
	}

	// ── Resolve domain from sender ────────────────────────────────────────────
	if (!domainId) {
		const senderDomain = body.from.split("@")[1];
		if (senderDomain) {
			const result = await db.query(`SELECT id FROM domains WHERE name = ? OR name LIKE ? LIMIT 1`, [
				senderDomain,
				`%.${senderDomain}`,
			]);
			domainId = (result.rows[0] as unknown as DomainRow | undefined)?.id ?? null;
		}
	}

	// ── Enforce domain-scoped key restrictions ────────────────────────────────
	if (apiKey.scope !== "global") {
		if (!domainId || !apiKey.allowedDomainIds.includes(domainId)) {
			return c.json({ error: "API key not authorized for this domain" }, 403);
		}
	}

	const now = new Date().toISOString();
	// Deduplicate recipients
	const toList = [...new Set(Array.isArray(body.to) ? body.to : [body.to])];

	// ── Send each recipient ───────────────────────────────────────────────────
	const results: Array<{ to: string; cfId?: string; error?: string }> = [];
	let successCount = 0;

	const publicOrigin = env.PUBLIC_URL.replace(/\/$/, "");

	for (const recipient of toList) {
		// ── Suppression check ─────────────────────────────────────────────────
		const suppressed = await db.query(`SELECT reason FROM suppressions WHERE email = ? LIMIT 1`, [
			recipient.toLowerCase(),
		]);
		if (suppressed.rows.length > 0) {
			results.push({ to: recipient, error: `Suppressed: ${(suppressed.rows[0] as { reason: string }).reason}` });
			continue;
		}

		// ── Issue one-time unsubscribe token when sending to a list ────────────
		let unsubscribeHeaders: Record<string, string> | undefined;
		if (body.listId && publicOrigin) {
			const token = generateId();
			await unsubscribeTokens.insert({
				token,
				email: recipient.toLowerCase(),
				list_id: body.listId,
				created_at: now,
			});
			unsubscribeHeaders = listUnsubscribeHeaders(publicOrigin, token, body.listUnsubscribePost ?? true);
		} else if (body.listUnsubscribe) {
			const headers: Record<string, string> = { "List-Unsubscribe": body.listUnsubscribe };
			if (body.listUnsubscribePost) headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
			unsubscribeHeaders = headers;
		}

		try {
			const out = await sendWithLog(
				{
					deliver: async (msg) =>
						isTest ? storeTestEmail(msg) : sendEmail(msg, env.CF_API_TOKEN, env.CF_ACCOUNT_ID),
					resolveDomainId: async () => domainId,
					insertLog: (row) => emailLogs.insert(row),
					templateId,
					apiKeyId: apiKey.keyId,
					idempotencyKey,
					isTest,
					storeBodies: isTest,
				},
				{
					from: body.fromName ? { address: body.from, name: body.fromName } : body.from,
					to: recipient,
					subject,
					html,
					text,
					replyTo: body.replyTo,
					...(unsubscribeHeaders ? { headers: unsubscribeHeaders } : {}),
				},
			);

			if (out.error) {
				results.push({ to: recipient, error: out.error });
				continue;
			}
			results.push({ to: recipient, cfId: out.cfId });
			successCount++;
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error";
			results.push({ to: recipient, error: message });
		}
	}

	// ── Update key usage stats (atomic increment to avoid race condition) ────────
	if (successCount > 0) {
		await db.exec(`UPDATE api_keys SET last_used_at = ?, send_count = send_count + ? WHERE id = ?`, [
			now,
			successCount,
			apiKey.keyId,
		]);
	}

	const allFailed = results.every((r) => r.error);
	return c.json({ results }, allFailed ? 502 : 200);
});

export default app;
