// Inbox (email address) management routes
// GET    /api/inbox/inboxes
// POST   /api/inbox/inboxes
// PUT    /api/inbox/inboxes/:id
// DELETE /api/inbox/inboxes/:id
// POST   /api/inbox/inboxes/:id/routing
// GET    /api/inbox/inboxes/:id/members
// POST   /api/inbox/inboxes/:id/members
// DELETE /api/inbox/inboxes/:id/members/:userId

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { generateId } from '@emailflare/email-core';
import { enableEmailRouting, setCatchAllToWorker, getZoneByHostname } from '../../services/cloudflare.ts';
import { requireAdmin } from '../../middleware/auth.ts';
import type { HonoEnv } from '../../env.ts';
import { inboxSchema } from '@emailflare/inbox-core';

const app = new Hono<HonoEnv>();

// Configure Cloudflare Email Routing so the zone's catch-all rule delivers
// inbound mail to the inbox worker. Returns { configured, error? } — never
// throws so callers can persist/surface the outcome.
async function configureRouting(
  email: string,
  cfApiToken: string,
  workerName: string,
): Promise<{ configured: boolean; error?: string }> {
  try {
    const domain = email.split('@')[1];
    const zone = await getZoneByHostname(domain, cfApiToken);
    if (!zone) return { configured: false, error: `No active Cloudflare zone found for "${domain}"` };
    await enableEmailRouting(zone.id, cfApiToken);
    await setCatchAllToWorker(zone.id, workerName, cfApiToken);
    return { configured: true };
  } catch (err) {
    return {
      configured: false,
      error: err instanceof Error ? err.message : 'Email Routing configuration failed',
    };
  }
}

// Map a persisted row → API shape (adds the `routing` object).
function toInbox(row: any) {
  const { routing_configured, routing_error, ...rest } = row;
  return {
    ...rest,
    routing: {
      configured: !!routing_configured,
      ...(routing_error ? { error: routing_error } : {}),
    },
  };
}

// GET /api/inbox/inboxes
app.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM inboxes ORDER BY created_at DESC').all();
  return c.json(rows.results.map(toInbox));
});

// POST /api/inbox/inboxes
app.post('/', requireAdmin, zValidator('json', inboxSchema), async (c) => {
  const body = c.req.valid('json');
  const existing = await c.env.DB.prepare('SELECT id FROM inboxes WHERE email = ? LIMIT 1').bind(body.email).first();
  if (existing) return c.json({ error: 'Inbox already exists' }, 409);

  // Configure Email Routing (catch-all → this Worker). If the token can't
  // configure routing we still create the inbox, but persist the failure so
  // the UI can offer a "Setup routing" retry.
  const routing = await configureRouting(body.email, c.env.CF_API_TOKEN, c.env.INBOX_WORKER_NAME);

  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO inboxes (id, email, display_name, mode, routing_configured, routing_error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(
    id,
    body.email,
    body.display_name,
    body.mode,
    routing.configured ? 1 : 0,
    routing.error ?? null,
    new Date().toISOString(),
  ).run();

  return c.json({ id, ...body, routing }, 201);
});

// POST /api/inbox/inboxes/:id/routing — (re)configure Email Routing for an inbox
app.post('/:id/routing', requireAdmin, async (c) => {
  const row = await c.env.DB.prepare('SELECT id, email FROM inboxes WHERE id = ? LIMIT 1').bind(c.req.param('id')).first();
  if (!row) return c.json({ error: 'Inbox not found' }, 404);

  const routing = await configureRouting(row.email as string, c.env.CF_API_TOKEN, c.env.INBOX_WORKER_NAME);

  await c.env.DB.prepare(
    'UPDATE inboxes SET routing_configured = ?, routing_error = ? WHERE id = ?',
  ).bind(routing.configured ? 1 : 0, routing.error ?? null, c.req.param('id')).run();

  return c.json({ ...row, routing });
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
