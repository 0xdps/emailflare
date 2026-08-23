// Inbox compose / reply routes
// POST /api/inbox/compose    — send new email to a person
// POST /api/inbox/reply      — reply to an inbound email

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { generateId, sendWithLog, resolveDomainId } from '@emailflare/email-core';
import { sendEmail, type CFSendEmailParams } from '../../services/cloudflare.ts';
import { D1Db } from '../../db.ts';
import type { HonoEnv } from '../../env.ts';
import { composeSchema, buildReplyToAddress, threadMessageId, upsertPerson, resolveThreadId } from '@emailflare/inbox-core';

const app = new Hono<HonoEnv>();

// POST /api/inbox/compose
app.post('/', zValidator('json', composeSchema), async (c) => {
  try {
  const body = c.req.valid('json');
  const now  = new Date().toISOString();
  const db   = new D1Db(c.env.DB);

  const personId = body.personId ?? (await upsertPerson(db, body.to, body.from, { generateId }));

  // A fresh token per message, embedded in the Reply-To address. When the
  // recipient replies, the +ef_<token> address routes back here so we can
  // thread the reply to exactly this message (Cloudflare controls the real
  // Message-ID, so headers alone can't do this).
  const threadToken = generateId();
  const syntheticMessageId = threadMessageId(threadToken);
  const replyToAddress = buildReplyToAddress(body.from, threadToken);
  const threadId = await resolveThreadId(db, body.inReplyTo, { generateId });

  const fromField: CFSendEmailParams['from'] = body.fromName
    ? { address: body.from, name: body.fromName }
    : body.from;

  // Forward threading headers so replies thread correctly in the recipient's
  // client too (In-Reply-To / References are allowlisted by CF). Reply-To is a
  // first-class field carrying our +ef_<token> plus-address.
  const headers: Record<string, string> = {};
  if (body.inReplyTo) headers['In-Reply-To'] = body.inReplyTo;
  if (body.references) headers['References'] = body.references;

  const result = await sendWithLog(
    {
      deliver: (msg) => sendEmail(
        { ...msg, replyTo: replyToAddress, ...(Object.keys(headers).length ? { headers } : {}) },
        c.env.CF_API_TOKEN,
        c.env.CF_ACCOUNT_ID,
      ),
      resolveDomainId: (from) => resolveDomainId(db, from),
      insertLog: async (row) => {
        await c.env.DB.prepare(
          `INSERT INTO email_logs (id, to_address, from_address, subject, status, cf_message_id, domain_id, template_id, api_key_id, idempotency_key, error, is_test, sent_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(row.id, row.to_address, row.from_address, row.subject, row.status, row.cf_message_id, row.domain_id, row.template_id, row.api_key_id, row.idempotency_key, row.error, row.is_test, row.sent_at).run();
      },
    },
    {
      from: fromField,
      to: body.to,
      subject: body.subject,
      html: body.html,
      text: body.text,
    },
  );

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO sent_inbox_emails (id, person_id, thread_id, in_reply_to, "references", message_id, thread_token, from_address, to_address, subject, body_text, status, cf_message_id, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, personId, threadId, body.inReplyTo ?? null, body.references ?? null, syntheticMessageId, threadToken, body.from, body.to, body.subject, body.text ?? null, 'sent', result.cfId ?? null, now).run();

  return c.json({ ok: true, id, threadId, personId, error: result.error });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[compose]', message, err);
    return c.json({ error: message }, 500);
  }
});

export default app;
