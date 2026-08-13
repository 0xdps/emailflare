// POST /v1/send
//
// Workers version differences vs. Node.js backend:
//   - Test-mode capture (in-house test mailbox) is not supported here.
//     Both test and live keys go through the Cloudflare Email Sending REST API.
//     The is_test flag is still stored in email_logs for audit purposes.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { makeDb, D1Db } from '../db.ts';
import { sendEmail } from '../services/cloudflare.ts';
import { renderLayout } from '../emails.ts';
import type { LayoutName } from '../emails.ts';
import type { HonoEnv, ApiKeyContext } from '../env.ts';
import { sendSchema, applyVariables, generateId } from '@emailflare/email-core';


const app = new Hono<HonoEnv>();

// POST /v1/send
app.post('/', zValidator('json', sendSchema), async (c) => {
  const body   = c.req.valid('json');
  const apiKey = c.get('apiKey') as ApiKeyContext;
  const { templates, emailLogs } = makeDb(c.env.DB);
  const db     = new D1Db(c.env.DB);

  // ── Idempotency check ──────────────────────────────────────────────────────
  const idempotencyKey = c.req.header('Idempotency-Key') ?? null;
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
  let subject = body.subject ?? '';
  let templateId: string | null = null;
  let domainId: string | null = null;

  // ── Resolve template ───────────────────────────────────────────────────────
  if (body.templateSlug || body.templateId) {
    const template = body.templateSlug
      ? await templates.findOne({ where: { slug: body.templateSlug } })
      : await templates.findOne({ where: { id: body.templateId! } });
    if (!template) return c.json({ error: 'Template not found' }, 404);

    const vars = body.variables ?? {};
    subject = applyVariables(body.subject ?? template.subject, vars);

    if (template.layout) {
      html = await renderLayout(template.layout as LayoutName, vars, body.themeId);
    } else {
      html = applyVariables(template.html_body, vars);
      text = template.text_body ? applyVariables(template.text_body, vars) : undefined;
    }
    templateId = template.id;
    domainId   = template.domain_id;
  }

  // ── Resolve domain from sender ─────────────────────────────────────────────
  if (!domainId) {
    const senderDomain = body.from.split('@')[1];
    if (senderDomain) {
      const result = await db.query<{ id: string }>(
        `SELECT id FROM domains WHERE name = ? OR name LIKE ? LIMIT 1`,
        [senderDomain, `%.${senderDomain}`],
      );
      domainId = result.rows[0]?.id ?? null;
    }
  }

  // ── Enforce domain-scoped key restrictions ─────────────────────────────────
  if (apiKey.scope !== 'global') {
    if (!domainId || !apiKey.allowedDomainIds.includes(domainId)) {
      return c.json({ error: 'API key not authorized for this domain' }, 403);
    }
  }

  const now    = new Date().toISOString();
  const toList = [...new Set(Array.isArray(body.to) ? body.to : [body.to])];
  const results: Array<{ to: string; cfId?: string; error?: string }> = [];
  let successCount = 0;

  for (const recipient of toList) {
    // ── Suppression check ──────────────────────────────────────────────────
    const suppressed = await db.query<{ reason: string }>(
      `SELECT reason FROM suppressions WHERE email = ? LIMIT 1`,
      [recipient.toLowerCase()],
    );
    if (suppressed.rows.length > 0) {
      results.push({ to: recipient, error: `Suppressed: ${suppressed.rows[0].reason}` });
      continue;
    }

    try {
      const cfResult = await sendEmail(
        {
          from: body.fromName ? { address: body.from, name: body.fromName } : body.from,
          to: recipient,
          subject,
          html,
          text,
          replyTo: body.replyTo,
        },
        c.env.CF_API_TOKEN,
        c.env.CF_ACCOUNT_ID,
      );

      await emailLogs.insert({
        id: generateId(),
        to_address: recipient,
        from_address: body.from,
        subject,
        status: 'sent',
        cf_message_id: cfResult.id ?? null,
        domain_id: domainId,
        template_id: templateId,
        api_key_id: apiKey.keyId,
        idempotency_key: idempotencyKey,
        error: null,
        is_test: apiKey.isTest ? 1 : 0,
        html_body: apiKey.isTest ? (html ?? null) : null,
        text_body: apiKey.isTest ? (text ?? null) : null,
        sent_at: now,
      });

      results.push({ to: recipient, cfId: cfResult.id });
      successCount++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';

      await emailLogs.insert({
        id: generateId(),
        to_address: recipient,
        from_address: body.from,
        subject,
        status: 'failed',
        cf_message_id: null,
        domain_id: domainId,
        template_id: templateId,
        api_key_id: apiKey.keyId,
        idempotency_key: null,
        error: message,
        is_test: apiKey.isTest ? 1 : 0,
        html_body: apiKey.isTest ? (html ?? null) : null,
        text_body: apiKey.isTest ? (text ?? null) : null,
        sent_at: now,
      });

      results.push({ to: recipient, error: message });
    }
  }

  // ── Update key usage ───────────────────────────────────────────────────────
  if (successCount > 0) {
    await db.run(
      `UPDATE api_keys SET last_used_at = ?, send_count = send_count + ? WHERE id = ?`,
      [now, successCount, apiKey.keyId],
    );
  }

  const allFailed = results.every(r => r.error);
  return c.json({ results }, allFailed ? 502 : 200);
});

export default app;
