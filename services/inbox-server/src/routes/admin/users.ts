// Admin: user management routes
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireSession, requireSuperAdmin } from '../../middleware/auth.js';
import { rawDb } from '../../db.js';
import type { HonoEnv } from '../../env.js';

const app = new Hono<HonoEnv>();

app.get('/', requireSession, requireSuperAdmin, async (c) => {
  const { rows } = await rawDb.query(
    'SELECT id, name, email, role, created_at FROM users ORDER BY created_at ASC',
  );
  return c.json(rows);
});

app.delete('/:id', requireSession, requireSuperAdmin, async (c) => {
  const id = c.req.param('id');
  if (id === c.get('userId')) return c.json({ error: 'Cannot delete own account' }, 400);

  const user = await rawDb.first<{ id: string; role: string }>('SELECT id, role FROM users WHERE id = ? LIMIT 1', [id]);
  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.role === 'super-admin') return c.json({ error: 'Cannot delete the owner account' }, 403);

  await rawDb.batch([
    { sql: 'DELETE FROM inbox_members     WHERE user_id = ?',  params: [id] },
    { sql: 'DELETE FROM push_subscriptions WHERE user_id = ?', params: [id] },
    { sql: 'DELETE FROM users             WHERE id = ?',       params: [id] },
  ]);

  return c.json({ deleted: true });
});

app.patch(
  '/:id/role',
  requireSession, requireSuperAdmin,
  zValidator('json', z.object({ role: z.enum(['admin', 'member', 'tester']) })),
  async (c) => {
    const id = c.req.param('id');
    if (id === c.get('userId')) return c.json({ error: 'Cannot change own role' }, 400);

    const user = await rawDb.first<{ id: string; role: string }>('SELECT id, role FROM users WHERE id = ? LIMIT 1', [id]);
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (user.role === 'super-admin') return c.json({ error: 'Cannot change the owner role' }, 403);

    const { role } = c.req.valid('json');
    await rawDb.run('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    return c.json({ updated: true });
  },
);

export default app;
