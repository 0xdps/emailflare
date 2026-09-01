// Inbox management routes
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { generateId } from '@emailflare/email-core';
import { enableEmailRouting, setCatchAllToWorker, getZoneByHostname } from '../../services/cloudflare.js';
import { requireAdmin } from '../../middleware/auth.js';
import { rawDb } from '../../db.js';
import { env } from '../../env.js';
import type { HonoEnv } from '../../env.js';
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

/** Row shape returned by inbox queries. */
interface InboxRow {
  id: string;
  email: string;
  display_name: string;
  mode: string;
  routing_configured: number;
  routing_error: string | null;
  created_at: string;
}

// Map a persisted row → API shape (adds the `routing` object).
function toInbox(row: InboxRow) {
  const { routing_configured, routing_error, ...rest } = row;
  return {
    ...rest,
    routing: {
      configured: !!routing_configured,
      ...(routing_error ? { error: routing_error } : {}),
    },
  };
}

app.get('/', async (c) => {
  const { rows } = await rawDb.query('SELECT * FROM inboxes ORDER BY created_at DESC');
  return c.json((rows as InboxRow[]).map(toInbox));
});

app.post('/', requireAdmin, zValidator('json', inboxSchema), async (c) => {
  const body = c.req.valid('json');
  const existing = await rawDb.first('SELECT id FROM inboxes WHERE email = ? LIMIT 1', [body.email]);
  if (existing) return c.json({ error: 'Inbox already exists' }, 409);

  // Configure Email Routing (catch-all → inbox worker). If the token can't
  // configure routing we still create the inbox, but persist the failure so
  // the UI can offer a "Setup routing" retry.
  const routing = await configureRouting(body.email, env.CF_API_TOKEN, env.INBOX_WORKER_NAME);

  const id = generateId();
  await rawDb.run(
    'INSERT INTO inboxes (id, email, display_name, mode, routing_configured, routing_error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, body.email, body.display_name, body.mode, routing.configured ? 1 : 0, routing.error ?? null, new Date().toISOString()],
  );
  return c.json({ id, ...body, routing }, 201);
});

// POST /api/inbox/inboxes/:id/routing — (re)configure Email Routing for an inbox
app.post('/:id/routing', requireAdmin, async (c) => {
  const row = await rawDb.first<{ id: string; email: string }>('SELECT id, email FROM inboxes WHERE id = ? LIMIT 1', [c.req.param('id')]);
  if (!row) return c.json({ error: 'Inbox not found' }, 404);

  const routing = await configureRouting(row.email, env.CF_API_TOKEN, env.INBOX_WORKER_NAME);

  await rawDb.run(
    'UPDATE inboxes SET routing_configured = ?, routing_error = ? WHERE id = ?',
    [routing.configured ? 1 : 0, routing.error ?? null, c.req.param('id')],
  );

  return c.json({ ...row, routing });
});

app.put('/:id', requireAdmin, zValidator('json', inboxSchema.partial()), async (c) => {
  const row = await rawDb.first('SELECT id FROM inboxes WHERE id = ? LIMIT 1', [c.req.param('id')]);
  if (!row) return c.json({ error: 'Inbox not found' }, 404);

  const updates = c.req.valid('json');
  const fields  = Object.keys(updates) as (keyof typeof updates)[];
  if (!fields.length) return c.json({ error: 'No fields to update' }, 400);

  const set    = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => updates[f]);
  await rawDb.run(`UPDATE inboxes SET ${set} WHERE id = ?`, [...values, c.req.param('id')]);
  return c.json({ ok: true });
});

app.delete('/:id', requireAdmin, async (c) => {
  const row = await rawDb.first('SELECT id FROM inboxes WHERE id = ? LIMIT 1', [c.req.param('id')]);
  if (!row) return c.json({ error: 'Inbox not found' }, 404);
  await rawDb.batch([
    { sql: 'DELETE FROM inbox_members WHERE inbox_id = ?', params: [c.req.param('id')] },
    { sql: 'DELETE FROM inboxes WHERE id = ?',             params: [c.req.param('id')] },
  ]);
  return c.json({ deleted: true });
});

app.get('/:id/members', async (c) => {
  const { rows } = await rawDb.query(
    `SELECT u.id, u.name, u.email, u.role
     FROM inbox_members im
     JOIN users u ON u.id = im.user_id
     WHERE im.inbox_id = ?`,
    [c.req.param('id')],
  );
  return c.json(rows);
});

app.post(
  '/:id/members',
  requireAdmin,
  zValidator('json', z.object({ userId: z.string() })),
  async (c) => {
    const { userId } = c.req.valid('json');
    const user = await rawDb.first('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!user) return c.json({ error: 'User not found' }, 404);
    await rawDb.run(
      'INSERT OR IGNORE INTO inbox_members (inbox_id, user_id) VALUES (?, ?)',
      [c.req.param('id'), userId],
    );
    return c.json({ ok: true }, 201);
  },
);

app.delete('/:id/members/:userId', requireAdmin, async (c) => {
  await rawDb.run(
    'DELETE FROM inbox_members WHERE inbox_id = ? AND user_id = ?',
    [c.req.param('id'), c.req.param('userId')],
  );
  return c.json({ deleted: true });
});

export default app;
