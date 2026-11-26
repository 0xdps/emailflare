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
import trackingRouter from "./routes/tracking.ts";
import webhooksRouter from "./routes/webhooks.ts";
import auditRouter from "./routes/audit.ts";
import totpRouter from "./routes/totp.ts";

// ── Inbox
import peopleRouter from "./routes/inbox/people.ts";
import threadsRouter from "./routes/inbox/threads.ts";
import attachmentsRouter from "./routes/inbox/attachments.ts";
import composeRouter from "./routes/inbox/compose.ts";
import inboxesRouter from "./routes/inbox/inboxes.ts";
import sequencesRouter from "./routes/inbox/sequences.ts";
import inboxTemplatesRouter from "./routes/inbox/inbox-templates.ts";

// ── Admin
import adminUsersRouter from "./routes/admin/users.ts";

// ── Middleware
import { checkRateLimit } from "./middleware/rateLimit.ts";
import { requireApiKey } from "./middleware/apiKey.ts";
import { guarded, requireSession, requireAdmin, requireApi, requireTester, requireInbox } from "./middleware/auth.ts";
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
app.route("/api/auth/totp", totpRouter);
app.route("/api", invitesRouter); // mounts /api/invites/:token and /api/admin/invites

// ── Public unsubscribe (token-authenticated, no API key) ───────────────────────
app.route("/v1/unsubscribe", unsubscribeRouter);
app.route("/v1/t", trackingRouter);

// ── Send API (API key auth + rate limiting) ───────────────────────────────────
app.use("/v1/*", async (c, next) => {
	if (new URL(c.req.url).pathname.startsWith("/v1/t/")) return next();
	return requireApiKey(c, next);
});
app.use("/v1/*", async (c, next) => {
	if (new URL(c.req.url).pathname.startsWith("/v1/t/")) return next();
	return checkRateLimit(c, next);
});
app.route("/v1/send", sendRouter);

// ── Authenticated session routes ──────────────────────────────────────────────
// Every router is mounted at its own prefix behind exactly one guard (see `guarded`).
const sessionApp = new Hono<HonoEnv>();
sessionApp.use("/*", requireSession);

// 1. Admin-only routes (requireAdmin)
sessionApp.route("/domains", guarded(requireAdmin, domainsRouter));
sessionApp.route("/keys", guarded(requireAdmin, keysRouter));
sessionApp.route("/admin/users", guarded(requireAdmin, adminUsersRouter));
sessionApp.route("/suppressions", guarded(requireAdmin, suppressionsRouter));
sessionApp.route("/webhooks", guarded(requireAdmin, webhooksRouter));
sessionApp.route("/audit", guarded(requireAdmin, auditRouter));
sessionApp.post("/seed", requireAdmin, async (c) => {
	await seedSystemTemplates(c.env.DB);
	return c.json({ ok: true });
});

// 2. API Dashboard routes (requireApi)
sessionApp.route("/logs", guarded(requireApi, logsRouter));
sessionApp.route("/templates", guarded(requireApi, templatesRouter));
sessionApp.route("/stats", guarded(requireApi, statsRouter));
sessionApp.route("/cloudflare", guarded(requireApi, cloudflareRouter));
sessionApp.route("/lists", guarded(requireApi, listsRouter));
sessionApp.route("/playground", guarded(requireApi, playgroundRouter));

// 3. Test Mailbox route (requireTester)
sessionApp.route("/test-emails", guarded(requireTester, testEmailsRouter));

// 4. Inbox routes (requireInbox)
sessionApp.route("/inbox/people", guarded(requireInbox, peopleRouter));
sessionApp.route("/inbox/threads", guarded(requireInbox, threadsRouter));
sessionApp.route("/inbox/attachments", guarded(requireInbox, attachmentsRouter));
sessionApp.route("/inbox/compose", guarded(requireInbox, composeRouter));
sessionApp.route("/inbox/inboxes", guarded(requireInbox, inboxesRouter));
sessionApp.route("/inbox/sequences", guarded(requireInbox, sequencesRouter));
sessionApp.route("/inbox/templates", guarded(requireInbox, inboxTemplatesRouter));

// WebSocket notification endpoint (per-user DO)
sessionApp.get("/notifications/ws", async (c) => {
	// Browsers always send Origin on WebSocket handshakes. Refuse pages from other sites so they
	// cannot open a socket with the user's cookie.
	const origin = c.req.header("Origin");
	if (origin && origin !== new URL(c.req.url).origin && origin !== c.env.PUBLIC_URL?.replace(/\/$/, "")) {
		return c.json({ error: "Forbidden" }, 403);
	}
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
export { processDueSequenceSteps, handleSequenceQueueMessage, deliverScheduledSend } from "./sequence-processor.ts";
