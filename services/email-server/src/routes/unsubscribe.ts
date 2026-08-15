// Public unsubscribe endpoint — no auth (the one-time token is the secret).
//
//   GET  /v1/unsubscribe?token=…  → confirmation HTML page (for browsers)
//   POST /v1/unsubscribe?token=…  → one-click unsubscribe (RFC 8058), returns 200
//
// Resolving a token inserts a `suppressions` row (reason 'unsubscribed') for the
// linked email, then deletes the token (single-use). Suppression is global: once
// unsubscribed, the address is suppressed for all future sends.

import { Hono } from 'hono';
import { db, unsubscribeTokens } from '../db.js';
import { generateId } from '@emailflare/email-core';

const app = new Hono();

async function performUnsubscribe(token: string): Promise<{ email: string } | null> {
  const rec = await unsubscribeTokens.findOne({ where: { token } });
  if (!rec) return null;

  await db.exec(
    `INSERT OR IGNORE INTO suppressions (id, email, reason, domain_id, email_log_id, list_id, created_at)
     VALUES (?, ?, 'unsubscribed', NULL, NULL, ?, ?)`,
    [generateId(), rec.email.toLowerCase(), rec.list_id, new Date().toISOString()],
  );
  await unsubscribeTokens.delete({ where: { token } });

  return { email: rec.email };
}

// GET — human-facing confirmation page
app.get('/', async (c) => {
  const token = c.req.query('token');
  if (!token) return c.html('<p>Missing unsubscribe token.</p>', 400);

  const result = await performUnsubscribe(token);
  if (!result) return c.html('<p>Invalid or expired unsubscribe link.</p>', 404);

  return c.html(`<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head><body style="font-family:system-ui;text-align:center;padding:4rem;"><h1>You've been unsubscribed</h1><p>${result.email} will no longer receive email from us.</p></body></html>`);
});

// POST — RFC 8058 one-click unsubscribe (mail client posts to the same URL)
app.post('/', async (c) => {
  const token = c.req.query('token') ?? (await c.req.parseBody().then(b => typeof b?.token === 'string' ? b.token : null).catch(() => null));
  if (!token) return c.json({ error: 'Missing unsubscribe token' }, 400);

  const result = await performUnsubscribe(token);
  if (!result) return c.json({ error: 'Invalid or expired unsubscribe token' }, 404);

  return c.json({ ok: true });
});

export default app;
