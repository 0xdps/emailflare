// IP-based login rate limiting using Redis (ioredis).
// Replaces the CF KV implementation in services/inbox-worker/src/middleware/loginRateLimit.ts.
// Uses atomic INCR + EXPIRE (sliding 60-second window, 10 attempts max).

import { Redis } from 'ioredis';
import { createLogger } from '@emailflare/email-core/logger';
import { env } from '../env.js';

const log = createLogger('loginRateLimit');

const LOGIN_LIMIT = 10;
const WINDOW_TTL  = 60; // seconds

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(env.REDIS_URL);
    _redis.on('error', (err) => log.error('Redis error:', err));
  }
  return _redis;
}

/**
 * Check whether the given IP is within the login rate limit.
 * Returns true if the attempt is allowed, false if the limit is exceeded.
 */
export async function checkLoginRateLimit(ip: string): Promise<boolean> {
  const redis = getRedis();
  const key   = `login_rl:${ip}`;

  const current = await redis.incr(key);
  if (current === 1) {
    // First attempt — start the window
    await redis.expire(key, WINDOW_TTL);
  }
  return current <= LOGIN_LIMIT;
}
