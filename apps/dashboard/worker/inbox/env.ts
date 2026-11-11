// Env interface — mirrors bindings declared in wrangler.jsonc.
// Extends worker's Env with inbox-specific bindings.

export interface ApiKeyContext {
	keyId: string;
	scope: string;
	allowedDomainIds: string[];
	isTest: boolean;
}

export interface Env {
	// ── D1 database ────────────────────────────────────────────────────────────
	DB: D1Database;

	// ── KV for login rate limiting ─────────────────────────────────────────────
	RATE_LIMIT_KV: KVNamespace;

	// ── Workers Rate Limiting (100 req / 60s per API key) ──────────────────────
	RATE_LIMITER: RateLimit;

	// ── R2 for email attachments ──────────────────────────────────────────────
	ATTACHMENTS: R2Bucket;

	// ── Durable Object for real-time notifications ────────────────────────────
	NOTIFICATIONS: DurableObjectNamespace;

	// ── Queue for sequence step delivery ─────────────────────────────────────
	EMAIL_QUEUE: Queue<SequenceQueueMessage | ScheduledSendMessage>;

	// ── Assets binding (dashboard SPA) ───────────────────────────────────────
	ASSETS: Fetcher;

	// ── Secrets ────────────────────────────────────────────────────────────────
	SESSION_SECRET: string;
	CF_API_TOKEN: string;
	CF_ACCOUNT_ID: string;
	VAPID_PUBLIC_KEY: string;
	VAPID_PRIVATE_KEY: string;

	// ── Public URL of this Worker (for unsubscribe links) ───────────────────────
	PUBLIC_URL?: string;

	// Daily transactional send ceiling shown on the overview. Defaults to 1000.
	CF_DAILY_LIMIT?: string;

	// ── Worker name used as the Email Routing catch-all destination ─────────────
	// Optional. When unset, routing uses the Worker name from wrangler config.
	INBOX_WORKER_NAME?: string;
}

export function inboxWorkerName(env: Pick<Env, "INBOX_WORKER_NAME">): string {
	return env.INBOX_WORKER_NAME?.trim() || "emailflare";
}

export type UserType = "admin" | "member";
export type AccessType = "inbox" | "api" | "tester";

// Hono generic type used by every route file
export type HonoEnv = {
	Bindings: Env;
	Variables: {
		apiKey: ApiKeyContext;
		userId: string;
		userType: UserType;
		accessTypes: AccessType[];
	};
};

// Message shape for sequence queue
export interface SequenceQueueMessage {
	type: "sequence_step";
	enrollmentId: string;
	stepIndex: number;
}

export interface ScheduledSendMessage {
	type: "scheduled_send";
	id: string;
}
