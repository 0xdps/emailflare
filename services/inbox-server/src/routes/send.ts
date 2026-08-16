import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { generateId, listUnsubscribeHeaders, sendWithLog } from '@emailflare/email-core';
import { makeDb, rawDb } from '../db.js';
import { sendEmail } from '../services/cloudflare.js';
import { renderLayout } from '@emailflare/emails';
import type { LayoutName } from '@emailflare/emails';
import { env } from '../env.js';
import type { HonoEnv, ApiKeyContext } from '../env.js';

const app = new Hono<HonoEnv>();

const sendSchema = z.object({
  from:         z.string().email(),
  fromName:     z.string().optional(),
  to:           z.union([z.string().email(), z.array(z.string().email()).max(50)]),
  replyTo:      z.string().email().optional(),
  subject:      z.string().min(1).optional(),
  html:         z.string().optional(),
  text:         z.string().optional(),
  templateId:   z.string().optional(),
  templateSlug: z.string().optional(),
  variables:    z.record(z.string()).optional(),
  themeId:      z.string().optional(),
  listId:       z.string().optional(),
  listUnsubscribe: z.string().optional(),
  listUnsubscribePost: z.boolean().optional(),
}).refine(d => d.templateId || d.templateSlug || d.html || d.text, {
  message: 'Provide templateId, templateSlug, or at least one of html/text',
});

function applyVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

app.post('/', zValidator('json', sendSchema), async (c) => {
  const body   = c.req.valid('json');
  const apiKey = c.get('apiKey') as ApiKeyContext;
  const { templates, emailLogs } = makeDb();

  // Idempotency
  const idempotencyKey = c.req.header('Idempotency-Key') ?? null;
  if (idempotencyKey) {
    const existing = await emailLogs.findOne({
      where: { idempotency_key: idempotencyKey, api_key_id: apiKey.keyId },
    });
    if (existing) {
      return c.json({ cached: true, results: [{ to: existing.to_address, cfId: existing.cf_message_id ?? undefined }] });
    }
  }

  let html = body.html;
  let text = body.text;
  let subject = body.subject ?? '';
  let templateId: string | null = null;
  let domainId:   string | null = null;

  if (body.templateSlug || body.templateId) {
    const template = body.templateSlug
      ? await templates.findOne({ where: { slug: body.templateSlug } })
      : await templates.findOne({ where: { id: body.templateId! } });
    if (!template) return c.json({ error: 'Template not found' }, 404);

    const vars = body.variables ?? {};
    subject    = applyVariables(body.subject ?? template.subject, vars);

    if (template.layout) {
      html = await renderLayout(template.layout as LayoutName, vars, body.themeId);
    } else {
      html = applyVariables(template.html_body, vars);
      text = template.text_body ? applyVariables(template.text_body, vars) : undefined;
    }
    templateId = template.id;
    domainId   = template.domain_id;
  }

  if (!domainId) {
    const senderDomain = body.from.split('@')[1];
    if (senderDomain) {
      const result = await rawDb.query<{ id: string }>(
        'SELECT id FROM domains WHERE name = ? OR name LIKE ? LIMIT 1',
        [senderDomain, `%.${senderDomain}`],
      );
      domainId = result.rows[0]?.id ?? null;
    }
  }

  if (apiKey.scope !== 'global') {
    if (!domainId || !apiKey.allowedDomainIds.includes(domainId)) {
      return c.json({ error: 'API key not authorized for this domain' }, 403);
    }
  }

  const now    = new Date().toISOString();
  const toList = [...new Set(Array.isArray(body.to) ? body.to : [body.to])];
  const results: Array<{ to: string; cfId?: string; error?: string }> = [];
  let successCount = 0;

  const publicOrigin = env.PUBLIC_URL.replace(/\/$/, '');

  for (const recipient of toList) {
    // ── Suppression check ─────────────────────────────────────────────────
    const suppressed = await rawDb.query<{ reason: string }>(
      'SELECT reason FROM suppressions WHERE email = ? LIMIT 1',
      [recipient.toLowerCase()],
    );
    if (suppressed.rows.length > 0) {
      results.push({ to: recipient, error: `Suppressed: ${suppressed.rows[0].reason}` });
      continue;
    }

    // ── Issue one-time unsubscribe token when sending to a list ────────────
    let unsubscribeHeaders: Record<string, string> | undefined;
    if (body.listId && publicOrigin) {
      const token = generateId();
      await rawDb.run(
        'INSERT INTO unsubscribe_tokens (token, email, list_id, created_at) VALUES (?, ?, ?, ?)',
        [token, recipient.toLowerCase(), body.listId, now],
      );
      unsubscribeHeaders = listUnsubscribeHeaders(publicOrigin, token, body.listUnsubscribePost ?? true);
    } else if (body.listUnsubscribe) {
      const headers: Record<string, string> = { 'List-Unsubscribe': body.listUnsubscribe };
      if (body.listUnsubscribePost) headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
      unsubscribeHeaders = headers;
    }

    try {
      // Test keys are captured to the Test Mailbox (no CF delivery); live keys send.
      const isTest = apiKey.isTest;
      const out = await sendWithLog(
        {
          deliver: async (msg) => isTest
            ? { id: generateId() }
            : sendEmail(msg, env.CF_API_TOKEN, env.CF_ACCOUNT_ID),
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
      const message = err instanceof Error ? err.message : 'Unknown error';
      results.push({ to: recipient, error: message });
    }
  }

  if (successCount > 0) {
    await rawDb.run(
      'UPDATE api_keys SET last_used_at = ?, send_count = send_count + ? WHERE id = ?',
      [now, successCount, apiKey.keyId],
    );
  }

  const allFailed = results.every(r => r.error);
  return c.json({ results }, allFailed ? 502 : 200);
});

export default app;
