// Invite management routes
// POST /api/admin/invites           — create invite (admin only)
// GET  /api/invites/:token          — validate token (public)
// POST /api/invites/:token/accept   — accept + create user (public)

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { generateId } from '@emailflare/email-core';
import { requireSession, requireAdmin, saveSession } from '../middleware/auth.js';
import { hashPassword } from '../lib/password.js';
import { rawDb } from '../db.js';
import type { HonoEnv } from '../env.js';

const app = new Hono<HonoEnv>();

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST /api/admin/invites
app.post(
  '/admin/invites',
  requireSession, requireAdmin,
  zValidator('json', z.object({
    email: z.string().email().toLowerCase(),
    role:  z.enum(['admin', 'member']).optional().default('member'),
  })),
  async (c) => {
    const { email, role: requestedRole } = c.req.valid('json');

    // Admins (non-super) can only invite members
    const callerRole = c.get('userRole');
    const role = callerRole === 'super-admin' ? requestedRole : 'member';

    const existing = await rawDb.first('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing) return c.json({ error: 'already_exists' }, 409);

    const rawToken  = generateId() + generateId();
    const tokenHash = await sha256Hex(rawToken);
    const id        = generateId();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const createdBy = c.get('userId');

    await rawDb.run(
      'INSERT INTO invites (id, email, token_hash, created_by, expires_at, role, used, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
      [id, email, tokenHash, createdBy, expiresAt, role, new Date().toISOString()],
    );

    const origin = new URL(c.req.url).origin;
    return c.json({ inviteUrl: `${origin}/invite/${rawToken}` }, 201);
  },
);

// GET /api/invites/:token
app.get('/invites/:token', async (c) => {
  const tokenHash = await sha256Hex(c.req.param('token'));
  const invite = await rawDb.first<{ id: string; email: string; expires_at: string; used: number }>(
    'SELECT id, email, expires_at, used FROM invites WHERE token_hash = ? LIMIT 1',
    [tokenHash],
  );
  if (!invite || invite.used) return c.json({ error: 'invite_not_found' }, 404);
  if (new Date(invite.expires_at) < new Date()) return c.json({ error: 'invite_expired' }, 410);
  return c.json({ email: invite.email });
});

const acceptSchema = z.object({
  name:     z.string().min(1).max(100),
  password: z.string().min(8),
});

// POST /api/invites/:token/accept
app.post('/invites/:token/accept', zValidator('json', acceptSchema), async (c) => {
  const tokenHash = await sha256Hex(c.req.param('token'));
  const invite = await rawDb.first<{ id: string; email: string; expires_at: string; used: number; role: string }>(
    'SELECT id, email, expires_at, used, role FROM invites WHERE token_hash = ? LIMIT 1',
    [tokenHash],
  );
  if (!invite || invite.used) return c.json({ error: 'invite_not_found' }, 404);
  if (new Date(invite.expires_at) < new Date()) return c.json({ error: 'invite_expired' }, 410);

  const { name, password } = c.req.valid('json');
  const passwordHash = await hashPassword(password);
  const userId = generateId();
  const now    = new Date().toISOString();
  const role   = (invite.role as 'admin' | 'member' | 'tester') ?? 'member';

  await rawDb.batch([
    { sql: 'INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)', params: [userId, name, invite.email, passwordHash, role, now] },
    { sql: 'UPDATE invites SET used = 1 WHERE id = ?', params: [invite.id] },
  ]);

  await saveSession(c, { userId, role, name, email: invite.email });
  return c.json({ ok: true }, 201);
});

export default app;
