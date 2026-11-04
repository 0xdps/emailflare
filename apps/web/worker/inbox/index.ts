// ── emailflare-inbox main entrypoint ─────────────────────────────────────────
//
// Hono API mounted by worker/index.ts for /health, /api/*, and /v1/*.
// The Next.js app owns every other HTTP path.

import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { createLogger } from "@emailflare/email-core/logger";

const log = createLogger("inbox-worker");

import type { HonoEnv } from "./env.ts";

// ── Auth / setup
import setupRouter from "./routes/setup.ts";
import authRouter from "./routes/auth.ts";
import invitesRouter from "./routes/invites.ts";

// ── Sending (copied from worker)
import domainsRouter from "./routes/domains.ts";
import keysRouter from "./routes/keys.ts";
import logsRouter from "./routes/logs.ts";
import sendRouter from "./routes/send.ts";
import templatesRouter from "./routes/templates.ts";
import statsRouter from "./routes/stats.ts";
import cloudflareRouter from "./routes/cloudflare.ts";
import listsRouter from "./routes/lists.ts";
import suppressionsRouter from "./routes/suppressions.ts";
import testEmailsRouter from "./routes/testEmails.ts";
import unsubscribeRouter from "./routes/unsubscribe.ts";

// ── Inbox
import peopleRouter from "./routes/inbox/people.ts";
import composeRouter from "./routes/inbox/compose.ts";
import inboxesRouter from "./routes/inbox/inboxes.ts";
import sequencesRouter from "./routes/inbox/sequences.ts";
import inboxTemplatesRouter from "./routes/inbox/inbox-templates.ts";

// ── Admin
import adminUsersRouter from "./routes/admin/users.ts";

// ── Middleware
import { checkRateLimit } from "./middleware/rateLimit.ts";
import { requireApiKey } from "./middleware/apiKey.ts";
import { requireSession, requireAdmin, requireTester } from "./middleware/auth.ts";
import { seedSystemTemplates } from "./seed.ts";

// ── Email + sequence handlers

// ── Durable Object (re-exported for wrangler)
export { NotificationsHub } from "./do/NotificationsHub.ts";

// ─────────────────────────────────────────────────────────────────────────────

const app = new Hono<HonoEnv>();

// ── CORS ──────────────────────────────────────────────────────────────────────
// Public send endpoint: open CORS
app.use(
	"/v1/*",
	cors({
		origin: "*",
		allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
	}),
);

// ── Public routes (no auth) ───────────────────────────────────────────────────
app.get("/health", (c) => c.json({ ok: true, service: "emailflare-inbox" }));
app.route("/api/setup", setupRouter);
app.route("/api/auth", authRouter);
app.route("/api", invitesRouter); // mounts /api/invites/:token and /api/admin/invites

// ── Public unsubscribe (token-authenticated, no API key) ───────────────────────
app.route("/v1/unsubscribe", unsubscribeRouter);

// ── Send API (API key auth + rate limiting) ───────────────────────────────────
app.use("/v1/*", requireApiKey, checkRateLimit);
app.route("/v1/send", sendRouter);

// ── Sending admin routes (session auth required) ──────────────────────────────
const adminApp = new Hono<HonoEnv>();
adminApp.use("/*", requireSession);

adminApp.route("/domains", domainsRouter);
adminApp.route("/keys", keysRouter);
adminApp.route("/logs", logsRouter);
adminApp.route("/templates", templatesRouter);
adminApp.route("/stats", statsRouter);
adminApp.route("/cloudflare", cloudflareRouter);
adminApp.route("/lists", listsRouter);
adminApp.route("/suppressions", suppressionsRouter);

// Test Mailbox — accessible to tester, admin, and super-admin roles
const testMailboxApp = new Hono<HonoEnv>();
testMailboxApp.use("/*", requireTester);
testMailboxApp.route("/", testEmailsRouter);
adminApp.route("/test-emails", testMailboxApp);

// ── Inbox routes (session auth required) ──────────────────────────────────────
adminApp.route("/inbox/people", peopleRouter);
adminApp.route("/inbox/compose", composeRouter);
adminApp.route("/inbox/inboxes", inboxesRouter);
adminApp.route("/inbox/sequences", sequencesRouter);
adminApp.route("/inbox/templates", inboxTemplatesRouter);

// Admin-only routes
const adminOnlyApp = new Hono<HonoEnv>();
adminOnlyApp.use("/*", requireAdmin);
adminOnlyApp.route("/users", adminUsersRouter);
adminApp.route("/admin", adminOnlyApp);

// WebSocket notification endpoint (per-user DO)
adminApp.get("/notifications/ws", async (c) => {
	const userId = c.get("userId");
	const id = c.env.NOTIFICATIONS.idFromName(userId);
	const stub = c.env.NOTIFICATIONS.get(id);
	return stub.fetch(c.req.raw);
});

// Seed endpoint (admin only, idempotent) — useful on first deploy
adminApp.post("/seed", requireAdmin, async (c) => {
	await seedSystemTemplates(c.env.DB);
	return c.json({ ok: true });
});

app.route("/api", adminApp);

app.notFound((c) => c.json({ error: "Not found" }, 404));

// ── Global error handler ──────────────────────────────────────────────────────
app.onError((err, c) => {
	if (err instanceof HTTPException) {
		return c.json({ error: err.message }, err.status);
	}
	log.error("unhandled error", err);
	return c.json({ error: "Internal server error" }, 500);
});

export { app };
export { handleIncomingEmail } from "./email-handler.ts";
export { processDueSequenceSteps, handleSequenceQueueMessage } from "./sequence-processor.ts";
