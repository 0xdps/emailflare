import { Hono } from 'hono';
import { db, emailLogs } from '../db.js';

const app = new Hono();

// GET /api/test-emails?page=1&limit=50&domainId=&search=&from=&to=
app.get('/', async (c) => {
  const page     = Math.max(1, parseInt(c.req.query('page')  ?? '1',  10));
  const limit    = Math.min(100, parseInt(c.req.query('limit') ?? '50', 10));
  const offset   = (page - 1) * limit;
  const domainId = c.req.query('domainId');
  const search   = c.req.query('search');
  const fromDate = c.req.query('from');  // ISO date string
  const toDate   = c.req.query('to');    // ISO date string

  // Build query with optional filters — always filter to test emails only
  const conditions: string[] = ['is_test = 1'];
  const params: unknown[]    = [];

  if (domainId) { conditions.push('domain_id = ?'); params.push(domainId); }
  if (fromDate) { conditions.push('sent_at >= ?');  params.push(fromDate); }
  if (toDate)   { conditions.push('sent_at <= ?');  params.push(toDate); }
  if (search) {
    conditions.push('(to_address LIKE ? OR from_address LIKE ? OR subject LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [dataResult, countResult] = await Promise.all([
    db.query(
      `SELECT * FROM email_logs ${where} ORDER BY sent_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    ),
    db.query(`SELECT COUNT(*) as total FROM email_logs ${where}`, params),
  ]);

  const total = (countResult.rows[0] as any)?.total ?? 0;

  return c.json({
    data: dataResult.rows,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});

// GET /api/test-emails/:id — single test email detail
app.get('/:id', async (c) => {
  const log = await emailLogs.findOne({ where: { id: c.req.param('id') } });
  if (!log) return c.json({ error: 'Test email not found' }, 404);
  if (log.is_test !== 1) return c.json({ error: 'Not a test email' }, 404);
  return c.json(log);
});

// DELETE /api/test-emails/:id — delete a test email
app.delete('/:id', async (c) => {
  const log = await emailLogs.findOne({ where: { id: c.req.param('id') } });
  if (!log) return c.json({ error: 'Test email not found' }, 404);
  if (log.is_test !== 1) return c.json({ error: 'Not a test email' }, 400);

  await emailLogs.delete({ where: { id: c.req.param('id') } });
  return c.json({ ok: true });
});

export default app;
