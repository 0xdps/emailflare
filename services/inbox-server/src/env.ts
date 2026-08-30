// Environment variables for inbox-server.
// No Cloudflare bindings — everything comes from process.env.

import crypto from 'node:crypto';

const required = (name: string): string => {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
};

/** Required in production; returns empty string in development with a warning. */
const optionalInDev = (name: string): string => {
  const val = process.env[name];
  if (!val) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    console.warn(`[env] ${name} not set — some features will be disabled in dev mode`);
    return '';
  }
  return val;
};

function sessionSecret(): string {
  const val = process.env.SESSION_SECRET;
  if (!val) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing required environment variable: SESSION_SECRET');
    }
    // Generate a random secret at startup for dev — never hardcoded.
    const generated = crypto.randomBytes(32).toString('hex');
    console.warn('[env] SESSION_SECRET not set — generated random dev secret (sessions will reset on restart)');
    return generated;
  }
  if (val.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return val;
}

export const env = {
  NODE_ENV:     process.env.NODE_ENV ?? 'development',
  PORT:         parseInt(process.env.INBOX_SERVER_PORT ?? process.env.PORT ?? '3002', 10),

  // Database — MesaHub connection string: mh://token@host/dbname
  // Use mh://local/inbox-db to start the bundled mesahub-server binary.
  MESAHUB_URL: required('MESAHUB_URL'),

  // Redis (rate limiting + BullMQ sequence queue)
  REDIS_URL: required('REDIS_URL'),

  // Auth
  SESSION_SECRET: sessionSecret(),

  // Cloudflare Email Sending API (used by send route + sequences)
  CF_API_TOKEN:  process.env.CF_API_TOKEN  ?? '',
  CF_ACCOUNT_ID: process.env.CF_ACCOUNT_ID ?? '',

  // VAPID keys for Web Push
  VAPID_PUBLIC_KEY:  process.env.VAPID_PUBLIC_KEY  ?? '',
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY ?? '',

  // Shared HMAC secret for inbound webhook from inbox-bridge CF Worker
  WEBHOOK_SECRET: optionalInDev('WEBHOOK_SECRET'),

  // Cloudflare R2 (attachment storage) — optional in dev
  R2_ACCOUNT_ID:        optionalInDev('R2_ACCOUNT_ID'),
  R2_ACCESS_KEY_ID:     optionalInDev('R2_ACCESS_KEY_ID'),
  R2_SECRET_ACCESS_KEY: optionalInDev('R2_SECRET_ACCESS_KEY'),
  R2_BUCKET_NAME:       process.env.R2_BUCKET_NAME ?? 'emailflare-inbox-attachments',

  // Migrations SQL directory (resolved at runtime)
  MIGRATIONS_DIR: process.env.MIGRATIONS_DIR ?? '/app/migrations',

  // Public URL of this server (for unsubscribe links)
  PUBLIC_URL: process.env.PUBLIC_URL ?? '',

  // Worker name used as the Email Routing catch-all destination
  INBOX_WORKER_NAME: process.env.INBOX_WORKER_NAME ?? 'emailflare-inbox-worker',

  // Dashboard SPA dist directory (served by Caddy, but path used by index.ts in dev)
  DASHBOARD_DIST: process.env.DASHBOARD_DIST ?? '/app/inbox-ui/dist',
} as const;

// API key context stored in Hono Variables
export interface ApiKeyContext {
  keyId: string;
  scope: string;
  allowedDomainIds: string[];
  isTest: boolean;
}

// Hono generic type — no CF bindings
export type HonoEnv = {
  Bindings: Record<string, never>;
  Variables: {
    apiKey: ApiKeyContext;
    userId: string;
    userRole: 'super-admin' | 'admin' | 'member' | 'tester';
  };
};

// Message shape for BullMQ sequence queue
export interface SequenceJobData {
  type: 'sequence_step';
  enrollmentId: string;
  stepIndex: number;
}
