// Inbox compose / reply routes
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { generateId } from '@emailflare/email-core';
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

app.post('/compose', zValidator('json', sendSchema), async (c) => {
  const body     = c.req.valid('json');
  const now      = new Date().toISOString();
  const personId = body.personId ?? (await upsertPerson(body.to, body.from));

  const fromField: CFSendEmailParams['from'] = body.fromName
    ? { address: body.from, name: body.fromName }
    : body.from;

  const result = await sendEmail(
    { from: fromField, to: body.to, subject: body.subject, html: body.html, text: body.text },
    env.CF_API_TOKEN,
    env.CF_ACCOUNT_ID,
  );

  const id = generateId();
  await rawDb.run(
    `INSERT INTO sent_inbox_emails
       (id, person_id, in_reply_to, from_address, to_address, subject, status, cf_message_id, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, personId, body.inReplyTo ?? null, body.from, body.to, body.subject, 'sent', result?.id ?? null, now],
  );

  return c.json({ ok: true, id });
});

export default app;
