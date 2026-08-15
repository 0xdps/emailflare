// Env interface — mirrors the bindings declared in wrangler.jsonc.
// Secrets are injected at runtime via `wrangler secret put`.

export interface Env {
  // ── D1 database ─────────────────────────────────────────────────────────────
  DB: D1Database;

  // ── KV for login rate limiting ───────────────────────────────────────────────
  RATE_LIMIT_KV: KVNamespace;

  // ── Workers Rate Limiting (100 req / 60s per API key) ───────────────────────
  RATE_LIMITER: RateLimit;

  // ── Secrets ──────────────────────────────────────────────────────────────────
  ADMIN_TOKEN: string;
  SESSION_SECRET: string;
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;

  // ── Public URL of this Worker (for unsubscribe links) ───────────────────────
  PUBLIC_URL: string;

  // ── CORS — comma-separated bare domains, e.g. "admin.example.com" ───────────
  ADMIN_ORIGIN: string;
}

// Hono generic type used by every route file.
// Variables that middleware sets on the context live here.
export type HonoEnv = {
  Bindings: Env;
  Variables: {
    apiKey: ApiKeyContext;
  };
};

export interface ApiKeyContext {
  keyId: string;
  scope: string;
  allowedDomainIds: string[];
  isTest: boolean;
}
