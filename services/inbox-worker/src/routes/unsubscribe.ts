// Public unsubscribe endpoint — no auth (the one-time token is the secret).
//
//   GET  /v1/unsubscribe?token=…  → confirmation page with a POST form
//   POST /v1/unsubscribe?token=…  → performs the unsubscribe (RFC 8058 one-click
//                                   posts here; the GET page's form posts here)
//
// GET never mutates: mail clients, link scanners and prefetchers fetch every URL
// in a message, and this URL is the List-Unsubscribe header. Acting on GET would
// suppress recipients who never clicked and burn their single-use token.
//
// Resolving a token inserts a `suppressions` row (reason 'unsubscribed') for the
// linked email, then deletes the token (single-use). Suppression is global: once
// unsubscribed, the address is suppressed for all future sends.

import { Hono } from "hono";
import { makeDb } from "../db.ts";
import {
	generateId,
	unsubscribeConfirmPage,
	unsubscribeDonePage,
	unsubscribeInvalidPage,
} from "@emailflare/email-core";
import type { HonoEnv } from "../env.ts";

const app = new Hono<HonoEnv>();

async function resolveToken(env: HonoEnv["Bindings"], token: string) {
	const { db } = makeDb(env.DB);
	const { rows } = await db.query<{ token: string; email: string; list_id: string | null }>(
		`SELECT token, email, list_id FROM unsubscribe_tokens WHERE token = ? LIMIT 1`,
		[token],
	);
	return rows[0] ?? null;
}

async function performUnsubscribe(env: HonoEnv["Bindings"], token: string): Promise<{ email: string } | null> {
	const { db } = makeDb(env.DB);
	const rec = await resolveToken(env, token);
	if (!rec) return null;

	await db.run(
		`INSERT OR IGNORE INTO suppressions (id, email, reason, domain_id, email_log_id, list_id, created_at)
     VALUES (?, ?, 'unsubscribed', NULL, NULL, ?, ?)`,
		[generateId(), rec.email.toLowerCase(), rec.list_id, new Date().toISOString()],
	);
	await db.run(`DELETE FROM unsubscribe_tokens WHERE token = ?`, [token]);

	return { email: rec.email };
}

// The browser form on the GET page and RFC 8058 one-click clients both POST here;
// answer the browser with a page and everything else with JSON.
function wantsHtml(c: { req: { header(name: string): string | undefined } }): boolean {
	return (c.req.header("accept") ?? "").includes("text/html");
}

// GET — confirmation page; the form on it POSTs back to this URL
app.get("/", async (c) => {
	const token = c.req.query("token");
	if (!token) return c.html(unsubscribeInvalidPage(), 400);

	const rec = await resolveToken(c.env, token);
	if (!rec) return c.html(unsubscribeInvalidPage(), 404);

	return c.html(unsubscribeConfirmPage(token));
});

// POST — RFC 8058 one-click unsubscribe (mail client posts to the same URL)
app.post("/", async (c) => {
	const token =
		c.req.query("token") ??
		(await c.req
			.parseBody()
			.then((b) => (typeof b?.token === "string" ? b.token : null))
			.catch(() => null));
	if (!token) return c.json({ error: "Missing unsubscribe token" }, 400);

	const result = await performUnsubscribe(c.env, token);
	if (!result) {
		return wantsHtml(c)
			? c.html(unsubscribeInvalidPage(), 404)
			: c.json({ error: "Invalid or expired unsubscribe token" }, 404);
	}

	return wantsHtml(c) ? c.html(unsubscribeDonePage(result.email)) : c.json({ ok: true });
});

export default app;
