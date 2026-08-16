// Inbox compose / reply routes
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { generateId, sendWithLog } from '@emailflare/email-core';
import { buildReplyToAddress, threadMessageId } from '@emailflare/inbox-core';
import { sendEmail, type CFSendEmailParams } from '../../services/cloudflare.js';
import { rawDb } from '../../db.js';
import { env } from '../../env.js';
import type { HonoEnv } from '../../env.js';

const app = new Hono<HonoEnv>();

const sendSchema = z.object({
  to:        z.string().email(),
  from:      z.string().email(),
  fromName:  z.string().optional(),
  subject:   z.string().min(1),
  html:      z.string().optional(),
  text:      z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.string().optional(),
  personId:  z.string().optional(),
});

async function upsertPerson(email: string, inboxAddress: string): Promise<string> {
  const existing = await rawDb.first<{ id: string }>(
    'SELECT id FROM people WHERE email = ? AND inbox_address = ? LIMIT 1',
    [email, inboxAddress],
  );
  if (existing) return existing.id;
  const id = generateId();
  await rawDb.run(
    'INSERT INTO people (id, email, name, inbox_address, created_at) VALUES (?, ?, NULL, ?, ?)',
    [id, email, inboxAddress, new Date().toISOString()],
  );
  return id;
}

// Resolve the thread_id a message belongs to. A reply inherits its parent's
// thread; a brand-new email gets its own thread.
async function resolveThreadId(inReplyTo: string | null | undefined): Promise<string> {
  if (inReplyTo) {
    const parent = await rawDb.first<{ thread_id: string | null }>(
      'SELECT thread_id FROM inbox_emails WHERE message_id = ? LIMIT 1',
      [inReplyTo],
    );
    if (parent?.thread_id) return parent.thread_id;
    const sent = await rawDb.first<{ thread_id: string | null }>(
      'SELECT thread_id FROM sent_inbox_emails WHERE message_id = ? LIMIT 1',
      [inReplyTo],
    );
    if (sent?.thread_id) return sent.thread_id;
  }
  return generateId();
}

app.post('/', zValidator('json', sendSchema), async (c) => {
  const body     = c.req.valid('json');
  const now      = new Date().toISOString();
  const personId = body.personId ?? (await upsertPerson(body.to, body.from));

  const fromField: CFSendEmailParams['from'] = body.fromName
    ? { address: body.from, name: body.fromName }
    : body.from;

  // A fresh token per message, embedded in the Reply-To address. When the
  // recipient replies, the +ef_<token> address routes back here so we can
  // thread the reply to exactly this message (Cloudflare controls the real
  // Message-ID, so headers alone can't do this).
  const threadToken = generateId();
  const syntheticMessageId = threadMessageId(threadToken);
  const replyToAddress = buildReplyToAddress(body.from, threadToken);
  const threadId = await resolveThreadId(body.inReplyTo);

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
        env.CF_API_TOKEN,
        env.CF_ACCOUNT_ID,
      ),
      resolveDomainId: async (from) => {
        const senderDomain = from.split('@')[1];
        if (!senderDomain) return null;
        const row = await rawDb.first<{ id: string }>('SELECT id FROM domains WHERE name = ? LIMIT 1', [senderDomain]);
        return row?.id ?? null;
      },
      insertLog: async (row) => {
        await rawDb.run(
          `INSERT INTO email_logs (id, to_address, from_address, subject, status, cf_message_id, domain_id, template_id, api_key_id, idempotency_key, error, is_test, sent_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [row.id, row.to_address, row.from_address, row.subject, row.status, row.cf_message_id, row.domain_id, row.template_id, row.api_key_id, row.idempotency_key, row.error, row.is_test, row.sent_at],
        );
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
  await rawDb.run(
    `INSERT INTO sent_inbox_emails
       (id, person_id, thread_id, in_reply_to, "references", message_id, thread_token, from_address, to_address, subject, status, cf_message_id, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, personId, threadId, body.inReplyTo ?? null, body.references ?? null, syntheticMessageId, threadToken, body.from, body.to, body.subject, 'sent', result.cfId ?? null, now],
  );

  return c.json({ ok: true, id, threadId, error: result.error });
});

export default app;
