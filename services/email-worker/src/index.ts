// Cloudflare Worker entry point for emailflare.
// Uses Hono for routing — identical API surface to the Node.js backend.
//
// Key differences vs the Node.js backend:
//   - Database: Cloudflare D1 (SQLite) instead of MesaHub
//   - Sessions: jose SignJWT instead of iron-session (no Node.js crypto)
//   - Rate limiting: Workers Rate Limiting binding + KV instead of in-memory
//   - Email sending: CF REST API only (no test-mailbox capture)
//   - Secrets: wrangler secrets (env bindings) instead of process.env

import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { HTTPException } from "hono/http-exception";
import { createLogger } from "@emailflare/email-core/logger";

import { requireAdminToken } from "./middleware/auth.ts";
import { requireApiKey } from "./middleware/apiKey.ts";
import { checkRateLimit } from "./middleware/rateLimit.ts";
import { LAYOUTS, renderLayout } from "./emails.ts";
import { seedSystemTemplates } from "./seed.ts";

const log = createLogger("email-worker");
import type { LayoutName } from "./emails.ts";
import type { Env, HonoEnv } from "./env.ts";

import authRoutes from "./routes/auth.ts";
import domainsRoutes from "./routes/domains.ts";
import templatesRoutes from "./routes/templates.ts";
import keysRoutes from "./routes/keys.ts";
import logsRoutes from "./routes/logs.ts";
import statsRoutes from "./routes/stats.ts";
import cloudflareRoutes from "./routes/cloudflare.ts";
import sendRoutes from "./routes/send.ts";
import suppressionsRoutes from "./routes/suppressions.ts";
import listsRoutes from "./routes/lists.ts";
import unsubscribeRoutes from "./routes/unsubscribe.ts";
import { handleInboundEmail } from "./email-handler.ts";

// ── CORS helpers ──────────────────────────────────────────────────────────────

function parseAdminOrigins(raw: string): string[] {
	return raw
		.split(",")
		.map((d) => d.trim())
		.filter(Boolean)
		.map((d) => {
			const isLocal = d.startsWith("localhost") || d.startsWith("127.0.0.1");
			return `${isLocal ? "http" : "https"}://${d}`;
		});
}

// ── App ───────────────────────────────────────────────────────────────────────

const app = new Hono<HonoEnv>();

app.use("*", secureHeaders());

// Public API: wide-open CORS for callers on any origin
app.use("/v1/*", (c, next) =>
	cors({
		origin: "*",
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
	})(c, next),
);

// Admin UI: origin-restricted CORS + credentials (session cookie)
app.use("/api/*", async (c, next) => {
	const raw = c.env.ADMIN_ORIGIN ?? "";
	const adminOrigins = parseAdminOrigins(raw);
	const isLocalDev = new URL(c.req.url).hostname === "localhost";
	const allowedOrigins = isLocalDev ? ["http://localhost:5173", ...adminOrigins] : adminOrigins;

	return cors({
		origin: allowedOrigins,
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type"],
		credentials: true,
	})(c, next);
});

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (c) => c.json({ ok: true, service: "emailflare-api-worker", ts: Date.now() }));

// ── Public unsubscribe (token-authenticated, no API key) ───────────────────────
app.route("/v1/unsubscribe", unsubscribeRoutes);

// ── Public send API (API key + rate limited) ───────────────────────────────────
app.use("/v1/send", requireApiKey);
app.use("/v1/send", checkRateLimit);
app.route("/v1/send", sendRoutes);

// ── Auth (public — login/logout/me) ──────────────────────────────────────────
app.route("/api/auth", authRoutes);

// ── Admin API (session protected) ────────────────────────────────────────────
const admin = new Hono<HonoEnv>();
admin.use("*", requireAdminToken);

// GET /api/layouts — list all built-in layout descriptors
admin.get("/layouts", (c) =>
	c.json(Object.entries(LAYOUTS).map(([id, { label, variables }]) => ({ id, label, variables }))),
);

// POST /api/layouts/:id/preview — render a built-in layout with variables
admin.post("/layouts/:id/preview", async (c) => {
	const id = c.req.param("id") as LayoutName;
	if (!LAYOUTS[id]) return c.json({ error: "Layout not found" }, 404);
	const body: { variables?: Record<string, string> } = await c.req.json().catch(() => ({}));
	const html = await renderLayout(id, body.variables ?? {});
	return c.json({ html });
});

admin.route("/domains", domainsRoutes);
admin.route("/templates", templatesRoutes);
admin.route("/keys", keysRoutes);
admin.route("/logs", logsRoutes);
admin.route("/stats", statsRoutes);
admin.route("/cloudflare", cloudflareRoutes);
admin.route("/suppressions", suppressionsRoutes);
admin.route("/lists", listsRoutes);

app.route("/api", admin);

// ── Error handler ─────────────────────────────────────────────────────────────
app.onError((err, c) => {
	if (err instanceof HTTPException) {
		return c.json({ error: err.message }, err.status);
	}
	log.error("unhandled error", err);
	return c.json({ error: "Internal server error" }, 500);
});

// ── Seed system templates on first deploy ────────────────────────────────────
// Call POST /api/_seed (admin-protected) once after `wrangler d1 migrations apply`.
app.post("/api/_seed", requireAdminToken, async (c) => {
	await seedSystemTemplates(c.env.DB);
	return c.json({ ok: true });
});

// ── Workers export ────────────────────────────────────────────────────────────
export default {
	fetch: app.fetch,

	// Handles inbound emails routed via Cloudflare Email Routing.
	// Wire up by adding an Email Routing rule that delivers mail to
	// the return-path address (e.g. bounces@return-path.yourdomain.com)
	// to this Worker.
	async email(message: ForwardableEmailMessage, env: Env, _ctx: ExecutionContext) {
		await handleInboundEmail(message, env);
	},
} satisfies ExportedHandler<Env>;
