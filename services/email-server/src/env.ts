const required = (name: string): string => {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
};

const DEV_SESSION_SECRET = 'emailflair-dev-secret-change-in-production-32ch';

function sessionSecret(): string {
  const val = process.env.SESSION_SECRET;
  if (!val) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing required environment variable: SESSION_SECRET');
    }
    console.warn('[env] SESSION_SECRET not set — using insecure dev default');
    return DEV_SESSION_SECRET;
  }
  if (val.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return val;
}

function adminToken(): string {
  const val = required('ADMIN_TOKEN');
  if (val.length < 32) throw new Error('ADMIN_TOKEN must be at least 32 characters');
  return val;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '3000', 10),
  ADMIN_TOKEN: adminToken(),
  SESSION_SECRET: sessionSecret(),
  MESAHUB_URL: required('MESAHUB_URL'),
  CF_API_TOKEN: process.env.CF_API_TOKEN ?? '',
  CF_ACCOUNT_ID: process.env.CF_ACCOUNT_ID ?? '',
  // Secret that must appear as Bearer token on POST /api/webhooks/bounce.
  // Leave unset to disable the webhook endpoint entirely.
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET ?? '',
  // Name of the CF Worker deployed as the bounce email forwarder.
  BOUNCE_WORKER_NAME: process.env.BOUNCE_WORKER_NAME ?? 'emailflare-api-bounce',
  // Publicly reachable URL of this backend (e.g. https://app.railway.app).
  // Used to pre-fill the Bounce Forwarding setup form in the admin UI.
  // Railway sets RAILWAY_PUBLIC_DOMAIN automatically; use that as fallback.
  PUBLIC_URL: process.env.PUBLIC_URL ??
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : ''),
} as const;
