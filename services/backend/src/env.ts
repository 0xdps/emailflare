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
} as const;
