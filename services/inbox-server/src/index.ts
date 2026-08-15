// ── emailflare inbox-server main entrypoint ───────────────────────────────────
//
// Node.js + Hono + @hono/node-server
//
// Lifecycle:
//   1. Run database migrations
//   2. Seed system templates (idempotent)
//   3. Start BullMQ sequence scheduler
//   4. Start HTTP server
//   5. Attach WebSocket manager to the same server
//   6. Register WebSocket upgrade handler at /api/notifications/ws

import { serve } from '@hono/node-server';
import type { Server as HttpServer } from 'node:http';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';

import { env } from './env.js';
import type { HonoEnv } from './env.js';
import { runMigrations } from './migrate.js';
import { seedSystemTemplates } from './seed.js';
import { startScheduler, stopScheduler } from './scheduler.js';
import { wsManager } from './websocket.js';
import { getSession } from './middleware/auth.js';
import { rawDb } from './db.js';

// ── Routes ────────────────────────────────────────────────────────────────────
import setupRouter    from './routes/setup.js';
import authRouter     from './routes/auth.js';
import invitesRouter  from './routes/invites.js';
import webhookRouter  from './routes/webhook.js';

import domainsRouter    from './routes/domains.js';
import keysRouter       from './routes/keys.js';
import logsRouter       from './routes/logs.js';
import sendRouter       from './routes/send.js';
import templatesRouter  from './routes/templates.js';
import statsRouter      from './routes/stats.js';
import cloudflareRouter from './routes/cloudflare.js';
import listsRouter      from './routes/lists.js';
import suppressionsRouter from './routes/suppressions.js';
import testEmailsRouter from './routes/testEmails.js';
import unsubscribeRouter from './routes/unsubscribe.js';

import peopleRouter         from './routes/inbox/people.js';
import composeRouter        from './routes/inbox/compose.js';
import inboxesRouter        from './routes/inbox/inboxes.js';
import sequencesRouter      from './routes/inbox/sequences.js';
import inboxTemplatesRouter from './routes/inbox/inbox-templates.js';
import adminUsersRouter     from './routes/admin/users.js';

// ── Middleware ────────────────────────────────────────────────────────────────
import { checkRateLimit }             from './middleware/rateLimit.js';
import { requireApiKey }              from './middleware/apiKey.js';
import { requireSession, requireAdmin, requireTester } from './middleware/auth.js';

// ─────────────────────────────────────────────────────────────────────────────

const app = new Hono<HonoEnv>();

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use('/v1/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
}));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (c) => c.json({ ok: true, service: 'emailflare-inbox-server' }));

// ── Public routes ─────────────────────────────────────────────────────────────
app.route('/api/setup',   setupRouter);
app.route('/api/auth',    authRouter);
app.route('/api',         invitesRouter); // /api/invites/:token + /api/admin/invites
app.route('/webhook',     webhookRouter); // /webhook/email (inbox-bridge posts here)

// ── Public unsubscribe (token-authenticated, no API key) ───────────────────────
app.route('/v1/unsubscribe', unsubscribeRouter);

// ── Send API (API key auth + rate limiting) ───────────────────────────────────
app.use('/v1/*', requireApiKey, checkRateLimit);
app.route('/v1/send', sendRouter);

// ── Session-protected API ─────────────────────────────────────────────────────
const protectedApp = new Hono<HonoEnv>();
protectedApp.use('/*', requireSession);

protectedApp.route('/domains',    domainsRouter);
protectedApp.route('/keys',       keysRouter);
protectedApp.route('/logs',       logsRouter);
protectedApp.route('/templates',  templatesRouter);
protectedApp.route('/stats',      statsRouter);
protectedApp.route('/cloudflare', cloudflareRouter);
protectedApp.route('/lists',      listsRouter);
protectedApp.route('/suppressions', suppressionsRouter);

// Test Mailbox — accessible to tester, admin, and super-admin roles
const testMailboxApp = new Hono<HonoEnv>();
testMailboxApp.use('/*', requireTester);
testMailboxApp.route('/', testEmailsRouter);
protectedApp.route('/test-emails', testMailboxApp);

protectedApp.route('/inbox/people',    peopleRouter);
protectedApp.route('/inbox/compose',   composeRouter);
protectedApp.route('/inbox/inboxes',   inboxesRouter);
protectedApp.route('/inbox/sequences', sequencesRouter);
protectedApp.route('/inbox/templates', inboxTemplatesRouter);

// Admin-only routes
const adminOnlyApp = new Hono<HonoEnv>();
adminOnlyApp.use('/*', requireAdmin);
adminOnlyApp.route('/users', adminUsersRouter);
protectedApp.route('/admin', adminOnlyApp);

// Seed endpoint (admin only, idempotent)
protectedApp.post('/seed', requireAdmin, async (c) => {
  await seedSystemTemplates();
  return c.json({ ok: true });
});

// WebSocket /api/notifications/ws is handled at the Node.js server level (see below)

app.route('/api', protectedApp);

// ── Global error handler ──────────────────────────────────────────────────────
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error('[unhandled]', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Startup
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('[startup] Running migrations…');
  await runMigrations();

  console.log('[startup] Seeding system templates…');
  await seedSystemTemplates();

  console.log('[startup] Starting sequence scheduler…');
  startScheduler();

  const port = env.PORT;

  console.log(`[startup] Starting HTTP server on port ${port}…`);

  const server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[startup] Listening on http://localhost:${info.port}`);
  }) as unknown as HttpServer;

  // Attach WebSocket manager to the http.Server
  wsManager.attach(server);

  // Handle WebSocket upgrades for /api/notifications/ws
  server.on('upgrade', async (req, socket, head) => {
    if (req.url !== '/api/notifications/ws') {
      socket.destroy();
      return;
    }

    // Validate session from Cookie header
    // We need a mock Hono Context to use getSession — instead, decode the
    // cookie directly using the same jose verification.
    const cookie = req.headers['cookie'] ?? '';
    const sessionToken = (() => {
      const match = cookie.match(/(?:^|;\s*)ef_inbox_session=([^;]+)/);
      return match ? match[1] : null;
    })();

    if (!sessionToken) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const { jwtVerify } = await import('jose');
    let userId: string;
    try {
      const { payload } = await jwtVerify(
        sessionToken,
        new TextEncoder().encode(env.SESSION_SECRET),
      );
      if (typeof payload['userId'] !== 'string') throw new Error('bad session');
      userId = payload['userId'];
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Verify user still exists
    const user = await rawDb.first('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wsManager.handleUpgrade(req, socket, head, userId);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[shutdown] Stopping scheduler…');
    await stopScheduler();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT',  shutdown);
}

main().catch(err => {
  console.error('[startup] Fatal error:', err);
  process.exit(1);
});
