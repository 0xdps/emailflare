// Inbox compose / reply routes
// POST /api/inbox/compose    — send new email to a person
// POST /api/inbox/reply      — reply to an inbound email

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { generateId } from '@emailflare/email-core';
import { sendEmail, type CFSendEmailParams } from '../../services/cloudflare.ts';
import type { HonoEnv } from '../../env.ts';
import { composeSchema } from '@emailflare/inbox-core';

const app = new Hono<HonoEnv>();

async function upsertPerson(env: HonoEnv['Bindings'], email: string, inboxAddress: string): Promise<string> {
  const existing = await env.DB.prepare(
    'SELECT id FROM people WHERE email = ? AND inbox_address = ? LIMIT 1',
  ).bind(email, inboxAddress).first<{ id: string }>();
  if (existing) return existing.id;
  const id = generateId();
  await env.DB.prepare(
    'INSERT INTO people (id, email, name, inbox_address, created_at) VALUES (?, ?, NULL, ?, ?)',
  ).bind(id, email, inboxAddress, new Date().toISOString()).run();
  return id;
}

// POST /api/inbox/compose
app.post('/', zValidator('json', composeSchema), async (c) => {
  const body = c.req.valid('json');
  const now  = new Date().toISOString();

  const personId = body.personId ?? (await upsertPerson(c.env, body.to, body.from));

  const fromField: CFSendEmailParams['from'] = body.fromName
    ? { address: body.from, name: body.fromName }
    : body.from;

  // Forward threading headers to Cloudflare so replies thread correctly in the
  // recipient's client too (In-Reply-To / References are allowlisted by CF).
  const headers: Record<string, string> = {};
  if (body.inReplyTo) headers['In-Reply-To'] = body.inReplyTo;
  if (body.references) headers['References'] = body.references;

  const result = await sendEmail(
    {
      from: fromField,
      to: body.to,
      subject: body.subject,
      html: body.html,
      text: body.text,
      ...(Object.keys(headers).length ? { headers } : {}),
    },
    c.env.CF_API_TOKEN,
    c.env.CF_ACCOUNT_ID,
  );

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO sent_inbox_emails (id, person_id, in_reply_to, "references", from_address, to_address, subject, status, cf_message_id, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, personId, body.inReplyTo ?? null, body.references ?? null, body.from, body.to, body.subject, 'sent', result?.id ?? null, now).run();

  return c.json({ ok: true, id });
});

export default app;
