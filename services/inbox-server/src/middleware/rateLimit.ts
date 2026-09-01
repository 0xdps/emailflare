// API-key rate limiting using Redis (ioredis).
// Replaces the CF Workers Rate Limiting binding in services/inbox-worker/src/middleware/rateLimit.ts.
// 100 requests per 60 seconds per key (sliding window via INCR+EXPIRE).

import { Redis } from 'ioredis';
import { createMiddleware } from 'hono/factory';
import { createLogger } from '@emailflare/email-core/logger';
import type { HonoEnv, ApiKeyContext } from '../env.js';
import { env } from '../env.js';

const log = createLogger('rateLimit');

const RATE_LIMIT = 100;
const WINDOW_TTL = 60; // seconds

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(env.REDIS_URL);
    _redis.on('error', (err) => log.error('Redis error:', err));
  }
  return _redis;
}

export const checkRateLimit = createMiddleware<HonoEnv>(async (c, next) => {
  const apiKey = c.get('apiKey') as ApiKeyContext;
  const redis  = getRedis();
  const key    = `api_rl:${apiKey.keyId}`;

  const current = await redis.incr(key);
  if (current === 1) await redis.expire(key, WINDOW_TTL);

  if (current > RATE_LIMIT) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  await next();
});
