// Invite management routes
// POST /api/admin/invites           — create invite (admin only)
// GET  /api/invites/:token          — validate token (public)
// POST /api/invites/:token/accept   — accept invite + create user (public)

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { generateId } from '@emailflare/email-core';
import { requireSession, requireAdmin, saveSession } from '../middleware/auth.ts';
import { hashPassword } from '../lib/password.ts';
import type { HonoEnv } from '../env.ts';

const app = new Hono<HonoEnv>();

// Hash the raw token for storage (only hash is stored; raw token goes in URL)
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST /api/admin/invites
app.post('/admin/invites', requireSession, requireAdmin, zValidator('json', z.object({
  email: z.string().email().toLowerCase(),
  role:  z.enum(['admin', 'member', 'tester']).optional().default('member'),
})), async (c) => {
  const { email, role: requestedRole } = c.req.valid('json');

  // Non-super-admins can only invite members
  const callerRole = c.get('userRole');
  const role = callerRole === 'super-admin' ? requestedRole : 'member';

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').bind(email).first();
  if (existing) return c.json({ error: 'already_exists' }, 409);

  const rawToken = generateId() + generateId();
  const tokenHash = await sha256Hex(rawToken);
  const id = generateId();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const createdBy = c.get('userId');

  await c.env.DB.prepare(
    'INSERT INTO invites (id, email, token_hash, created_by, expires_at, role, used, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
  ).bind(id, email, tokenHash, createdBy, expiresAt, role, new Date().toISOString()).run();

  const origin = new URL(c.req.url).origin;
  return c.json({ inviteUrl: `${origin}/invite/${rawToken}` }, 201);
});

// GET /api/invites/:token
app.get('/invites/:token', async (c) => {
  const rawToken = c.req.param('token');
  const tokenHash = await sha256Hex(rawToken);

  const invite = await c.env.DB.prepare(
    'SELECT id, email, expires_at, used FROM invites WHERE token_hash = ? LIMIT 1',
  ).bind(tokenHash).first<{ id: string; email: string; expires_at: string; used: number }>();

  if (!invite) return c.json({ error: 'invite_not_found' }, 404);
  if (invite.used) return c.json({ error: 'invite_not_found' }, 404);
  if (new Date(invite.expires_at) < new Date()) return c.json({ error: 'invite_expired' }, 410);

  return c.json({ email: invite.email });
});

const acceptSchema = z.object({
  name: z.string().min(1).max(100),
  password: z.string().min(8),
});

// POST /api/invites/:token/accept
app.post('/invites/:token/accept', zValidator('json', acceptSchema), async (c) => {
  const rawToken = c.req.param('token');
  const tokenHash = await sha256Hex(rawToken);

  const invite = await c.env.DB.prepare(
    'SELECT id, email, expires_at, used, role FROM invites WHERE token_hash = ? LIMIT 1',
  ).bind(tokenHash).first<{ id: string; email: string; expires_at: string; used: number; role: string }>();

  if (!invite) return c.json({ error: 'invite_not_found' }, 404);
  if (invite.used) return c.json({ error: 'invite_not_found' }, 404);
  if (new Date(invite.expires_at) < new Date()) return c.json({ error: 'invite_expired' }, 410);

  const { name, password } = c.req.valid('json');
  const passwordHash = await hashPassword(password);
  const userId = generateId();
  const now = new Date().toISOString();
  const role = (invite.role as 'admin' | 'member' | 'tester') ?? 'member';

  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(userId, name, invite.email, passwordHash, role, now),
    c.env.DB.prepare('UPDATE invites SET used = 1 WHERE id = ?').bind(invite.id),
  ]);

  await saveSession(c, { userId, role, name, email: invite.email });
  return c.json({ ok: true }, 201);
});

export default app;
