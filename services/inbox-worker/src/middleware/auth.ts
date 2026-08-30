// Cookie-based session for inbox: email+password auth.
// Payload: { userId, role } — HS256 signed with SESSION_SECRET.

import { SignJWT, jwtVerify } from 'jose';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import type { Context } from 'hono';
import type { HonoEnv } from '../env.ts';

export interface SessionPayload {
  userId: string;
  role: 'super-admin' | 'admin' | 'member' | 'tester';
  name: string;
  email: string;
}

const SESSION_COOKIE = 'ef_inbox_session';
const SESSION_TTL    = 60 * 60 * 24 * 7; // 7 days
const ALG            = 'HS256';

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function getSession(c: Context<HonoEnv>): Promise<SessionPayload | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(c.env.SESSION_SECRET));
    if (
      typeof payload['userId'] !== 'string' ||
      typeof payload['role'] !== 'string' ||
      typeof payload['name'] !== 'string' ||
      typeof payload['email'] !== 'string'
    ) return null;
    return {
      userId: payload['userId'] as string,
      role: payload['role'] as SessionPayload['role'],
      name: payload['name'] as string,
      email: payload['email'] as string,
    };
  } catch {
    return null;
  }
}

export async function saveSession(c: Context<HonoEnv>, data: SessionPayload): Promise<void> {
  const token = await new SignJWT({
    userId: data.userId,
    role: data.role,
    name: data.name,
    email: data.email,
  })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(secretKey(c.env.SESSION_SECRET));

  const isLocalDev = new URL(c.req.url).hostname === 'localhost';

  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: !isLocalDev,
    sameSite: 'Strict',
    path: '/',
    maxAge: SESSION_TTL,
  });
}

export function clearSession(c: Context<HonoEnv>): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

/** Middleware: require valid session, set userId + userRole on context. */
export const requireSession = createMiddleware<HonoEnv>(async (c, next) => {
  const session = await getSession(c);
  if (!session) throw new HTTPException(401, { message: 'Unauthorized' });
  c.set('userId', session.userId);
  c.set('userRole', session.role);
  await next();
});

/** Middleware: require admin or super-admin role. Must be chained after requireSession. */
export const requireAdmin = createMiddleware<HonoEnv>(async (c, next) => {
  const role = c.get('userRole');
  if (role !== 'admin' && role !== 'super-admin') throw new HTTPException(403, { message: 'Forbidden' });
  await next();
});

/** Middleware: require super-admin role only. Must be chained after requireSession. */
export const requireSuperAdmin = createMiddleware<HonoEnv>(async (c, next) => {
  const role = c.get('userRole');
  if (role !== 'super-admin') throw new HTTPException(403, { message: 'Forbidden' });
  await next();
});

/** Middleware: require tester, admin, or super-admin role (Test Mailbox access). */
export const requireTester = createMiddleware<HonoEnv>(async (c, next) => {
  const role = c.get('userRole');
  if (role !== 'tester' && role !== 'admin' && role !== 'super-admin') {
    throw new HTTPException(403, { message: 'Forbidden' });
  }
  await next();
});
