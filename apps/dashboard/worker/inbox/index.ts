// ── emailflare-inbox main entrypoint ─────────────────────────────────────────
//
// Hono API mounted by worker/index.ts for /health, /api/*, and /v1/*.
// The Next.js app owns every other HTTP path.

import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { createLogger } from "@/lib/core";

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
import playgroundRouter from "./routes/playground.ts";

// ── Inbox
import peopleRouter from "./routes/inbox/people.ts";
import threadsRouter from "./routes/inbox/threads.ts";
import composeRouter from "./routes/inbox/compose.ts";
import inboxesRouter from "./routes/inbox/inboxes.ts";
import sequencesRouter from "./routes/inbox/sequences.ts";
import inboxTemplatesRouter from "./routes/inbox/inbox-templates.ts";

// ── Admin
import adminUsersRouter from "./routes/admin/users.ts";

// ── Middleware
import { checkRateLimit } from "./middleware/rateLimit.ts";
import { requireApiKey } from "./middleware/apiKey.ts";
import { requireSession, requireAdmin, requireApi, requireTester, requireInbox } from "./middleware/auth.ts";
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

// ── Authenticated session routes ──────────────────────────────────────────────
const sessionApp = new Hono<HonoEnv>();
sessionApp.use("/*", requireSession);

// 1. Admin-only routes (requireAdmin)
const adminApp = new Hono<HonoEnv>();
adminApp.use("/*", requireAdmin);
adminApp.route("/domains", domainsRouter);
adminApp.route("/keys", keysRouter);
adminApp.route("/admin/users", adminUsersRouter);
adminApp.post("/seed", async (c) => {
	await seedSystemTemplates(c.env.DB);
	return c.json({ ok: true });
});
sessionApp.route("/", adminApp);

// 2. API Dashboard routes (requireApi)
const apiApp = new Hono<HonoEnv>();
apiApp.use("/*", requireApi);
apiApp.route("/logs", logsRouter);
apiApp.route("/templates", templatesRouter);
apiApp.route("/stats", statsRouter);
apiApp.route("/cloudflare", cloudflareRouter);
apiApp.route("/lists", listsRouter);
apiApp.route("/suppressions", suppressionsRouter);
apiApp.route("/playground", playgroundRouter);
sessionApp.route("/", apiApp);

// 3. Test Mailbox route (requireTester)
const testMailboxApp = new Hono<HonoEnv>();
testMailboxApp.use("/*", requireTester);
testMailboxApp.route("/test-emails", testEmailsRouter);
sessionApp.route("/", testMailboxApp);

// 4. Inbox routes (requireInbox)
const inboxApp = new Hono<HonoEnv>();
inboxApp.use("/*", requireInbox);
inboxApp.route("/inbox/people", peopleRouter);
inboxApp.route("/inbox/threads", threadsRouter);
inboxApp.route("/inbox/compose", composeRouter);
inboxApp.route("/inbox/inboxes", inboxesRouter);
inboxApp.route("/inbox/sequences", sequencesRouter);
inboxApp.route("/inbox/templates", inboxTemplatesRouter);
sessionApp.route("/", inboxApp);

// WebSocket notification endpoint (per-user DO)
sessionApp.get("/notifications/ws", async (c) => {
	const userId = c.get("userId");
	const id = c.env.NOTIFICATIONS.idFromName(userId);
	const stub = c.env.NOTIFICATIONS.get(id);
	return stub.fetch(c.req.raw);
});

app.route("/api", sessionApp);

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
