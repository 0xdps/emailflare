// Inbox (email address) management routes
// GET    /api/inbox/inboxes
// POST   /api/inbox/inboxes
// PUT    /api/inbox/inboxes/:id
// DELETE /api/inbox/inboxes/:id
// GET    /api/inbox/inboxes/:id/members
// POST   /api/inbox/inboxes/:id/members
// DELETE /api/inbox/inboxes/:id/members/:userId

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { generateId } from '@emailflare/email-core';
import { requireAdmin } from '../../middleware/auth.ts';
import type { HonoEnv } from '../../env.ts';
import { inboxSchema } from '@emailflare/inbox-core';

const app = new Hono<HonoEnv>();

// GET /api/inbox/inboxes
app.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM inboxes ORDER BY created_at DESC').all();
  return c.json(rows.results);
});

// POST /api/inbox/inboxes
app.post('/', requireAdmin, zValidator('json', inboxSchema), async (c) => {
  const body = c.req.valid('json');
  const existing = await c.env.DB.prepare('SELECT id FROM inboxes WHERE email = ? LIMIT 1').bind(body.email).first();
  if (existing) return c.json({ error: 'Inbox already exists' }, 409);

  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO inboxes (id, email, display_name, mode, created_at) VALUES (?, ?, ?, ?, ?)',
  ).bind(id, body.email, body.display_name, body.mode, new Date().toISOString()).run();

  return c.json({ id, ...body }, 201);
});

// PUT /api/inbox/inboxes/:id
app.put('/:id', requireAdmin, zValidator('json', inboxSchema.partial()), async (c) => {
  const row = await c.env.DB.prepare('SELECT id FROM inboxes WHERE id = ? LIMIT 1').bind(c.req.param('id')).first();
  if (!row) return c.json({ error: 'Inbox not found' }, 404);

  const updates = c.req.valid('json');
  const fields  = Object.keys(updates) as (keyof typeof updates)[];
  if (!fields.length) return c.json({ error: 'No fields to update' }, 400);

  const set     = fields.map(f => `${f} = ?`).join(', ');
  const values  = fields.map(f => updates[f]);

  await c.env.DB.prepare(`UPDATE inboxes SET ${set} WHERE id = ?`).bind(...values, c.req.param('id')).run();
  return c.json({ ok: true });
});

// DELETE /api/inbox/inboxes/:id
app.delete('/:id', requireAdmin, async (c) => {
  const row = await c.env.DB.prepare('SELECT id FROM inboxes WHERE id = ? LIMIT 1').bind(c.req.param('id')).first();
  if (!row) return c.json({ error: 'Inbox not found' }, 404);

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM inbox_members WHERE inbox_id = ?').bind(c.req.param('id')),
    c.env.DB.prepare('DELETE FROM inboxes WHERE id = ?').bind(c.req.param('id')),
  ]);
  return c.json({ deleted: true });
});

// GET /api/inbox/inboxes/:id/members
app.get('/:id/members', async (c) => {
  const members = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.role
     FROM inbox_members im
     JOIN users u ON u.id = im.user_id
     WHERE im.inbox_id = ?`,
  ).bind(c.req.param('id')).all();
  return c.json(members.results);
});

// POST /api/inbox/inboxes/:id/members
app.post('/:id/members', requireAdmin, zValidator('json', z.object({ userId: z.string() })), async (c) => {
  const { userId } = c.req.valid('json');
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ? LIMIT 1').bind(userId).first();
  if (!user) return c.json({ error: 'User not found' }, 404);

  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO inbox_members (inbox_id, user_id) VALUES (?, ?)',
  ).bind(c.req.param('id'), userId).run();
  return c.json({ ok: true }, 201);
});

// DELETE /api/inbox/inboxes/:id/members/:userId
app.delete('/:id/members/:userId', requireAdmin, async (c) => {
  await c.env.DB.prepare(
    'DELETE FROM inbox_members WHERE inbox_id = ? AND user_id = ?',
  ).bind(c.req.param('id'), c.req.param('userId')).run();
  return c.json({ deleted: true });
});

export default app;
