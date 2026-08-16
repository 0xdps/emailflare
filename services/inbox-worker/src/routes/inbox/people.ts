// People CRM routes
// GET  /api/inbox/people                    — list people (paginated, search)
// GET  /api/inbox/people/:id                — single person with thread
// POST /api/inbox/people/:id/mark-read      — mark all emails read
// GET  /api/inbox/people/:id/thread         — email thread (inbox + sent)

import { Hono } from 'hono';
import type { HonoEnv } from '../../env.ts';

const app = new Hono<HonoEnv>();

// GET /api/inbox/people
app.get('/', async (c) => {
  const page   = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const limit  = Math.min(100, parseInt(c.req.query('limit') ?? '50', 10));
  const offset = (page - 1) * limit;
  const search = c.req.query('search');
  const unread = c.req.query('unread') === '1';

  let sql = `
    SELECT p.id, p.email, p.name, p.created_at,
           COUNT(DISTINCT ie.id) AS email_count,
           SUM(CASE WHEN ie.is_read = 0 THEN 1 ELSE 0 END) AS unread_count,
           MAX(ie.received_at) AS last_activity_at
    FROM people p
    LEFT JOIN inbox_emails ie ON ie.person_id = p.id
  `;
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (search) {
    conditions.push('(p.email LIKE ? OR p.name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (unread) conditions.push('ie.is_read = 0');

  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
  sql += ' GROUP BY p.id ORDER BY last_activity_at DESC NULLS LAST LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [data, count] = await Promise.all([
    c.env.DB.prepare(sql).bind(...params).all(),
    c.env.DB.prepare(`SELECT COUNT(*) as total FROM people p ${conditions.length ? 'LEFT JOIN inbox_emails ie ON ie.person_id = p.id WHERE ' + conditions.join(' AND ') : ''}`).bind(...params.slice(0, -2)).first<{ total: number }>(),
  ]);

  return c.json({
    data: data.results,
    total: count?.total ?? 0,
    page,
    limit,
    pages: Math.ceil((count?.total ?? 0) / limit),
  });
});

// GET /api/inbox/people/:id
app.get('/:id', async (c) => {
  const person = await c.env.DB.prepare(
    'SELECT * FROM people WHERE id = ? LIMIT 1',
  ).bind(c.req.param('id')).first();
  if (!person) return c.json({ error: 'Person not found' }, 404);
  return c.json(person);
});

// GET /api/inbox/people/:id/thread
app.get('/:id/thread', async (c) => {
  const personId = c.req.param('id');
  const page   = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const limit  = Math.min(100, parseInt(c.req.query('limit') ?? '50', 10));
  const offset = (page - 1) * limit;

  const person = await c.env.DB.prepare('SELECT * FROM people WHERE id = ? LIMIT 1').bind(personId).first();
  if (!person) return c.json({ error: 'Person not found' }, 404);

  // Merge received + sent, ordered by time
  const thread = await c.env.DB.prepare(`
    SELECT id, 'inbound' AS direction, subject, body_html, body_text, body_r2_key,
           message_id, in_reply_to, "references", is_read, received_at AS timestamp, inbox_address
    FROM inbox_emails WHERE person_id = ?
    UNION ALL
    SELECT id, 'outbound' AS direction, subject, NULL, NULL, NULL,
           NULL, in_reply_to, "references", 1, sent_at AS timestamp, from_address AS inbox_address
    FROM sent_inbox_emails WHERE person_id = ?
    ORDER BY timestamp DESC LIMIT ? OFFSET ?
  `).bind(personId, personId, limit, offset).all();

  const [count] = await Promise.all([
    c.env.DB.prepare(
      'SELECT (SELECT COUNT(*) FROM inbox_emails WHERE person_id = ?) + (SELECT COUNT(*) FROM sent_inbox_emails WHERE person_id = ?) AS total',
    ).bind(personId, personId).first<{ total: number }>(),
  ]);

  return c.json({
    person,
    thread: thread.results,
    total: count?.total ?? 0,
    page,
    limit,
    pages: Math.ceil((count?.total ?? 0) / limit),
  });
});

// POST /api/inbox/people/:id/mark-read
app.post('/:id/mark-read', async (c) => {
  const personId = c.req.param('id');
  await c.env.DB.prepare(
    'UPDATE inbox_emails SET is_read = 1 WHERE person_id = ?',
  ).bind(personId).run();
  return c.json({ ok: true });
});

export default app;
