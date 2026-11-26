// Public open pixel and click redirect. Tokens are issued only when a send opts into tracking.
//
// Click links are signed (`s`) so they can only redirect to the URL they were issued for.
// Links without a valid signature (sent before signing existed, or forged) never redirect
// on their own: the visitor gets a confirmation page that shows the real destination.

import { Hono } from "hono";
import { generateId, timingSafeEqual, trackingSignature } from "@/lib/core";
import { dispatchWebhooks } from "../lib/webhooks.ts";
import type { HonoEnv } from "../env.ts";

const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));

const app = new Hono<HonoEnv>();

type Ctx = { env: HonoEnv["Bindings"]; executionCtx: { waitUntil(promise: Promise<unknown>): void } };

async function isIssued(env: HonoEnv["Bindings"], token: string): Promise<boolean> {
	if (!token || token.length > 128) return false;
	const row = await env.DB.prepare("SELECT 1 AS ok FROM email_events WHERE token = ? AND kind = 'issued' LIMIT 1")
		.bind(token)
		.first();
	return !!row;
}

// Unknown tokens are ignored so anyone can't write events or trigger webhooks.
async function record(c: Ctx, token: string, kind: "open" | "click", url?: string) {
	if (!(await isIssued(c.env, token))) return;
	c.executionCtx.waitUntil(
		(async () => {
			await c.env.DB.prepare(
				"INSERT INTO email_events (id, email_log_id, token, kind, url, created_at) VALUES (?, NULL, ?, ?, ?, ?)",
			)
				.bind(generateId(), token, kind, url ?? null, new Date().toISOString())
				.run();
			await dispatchWebhooks(c.env, kind === "open" ? "email.opened" : "email.clicked", {
				token,
				url: url ?? null,
			});
		})(),
	);
}

function webUrl(raw: string): string | null {
	try {
		const url = new URL(raw);
		return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
	} catch {
		return null;
	}
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

app.get("/o/:token", async (c) => {
	await record(c, c.req.param("token"), "open");
	return new Response(PIXEL, {
		headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
	});
});

app.get("/c/:token", async (c) => {
	const token = c.req.param("token");
	const destination = webUrl(c.req.query("u") ?? "");
	if (!destination) return c.redirect("/", 302);

	const signature = c.req.query("s") ?? "";
	const expected = await trackingSignature(c.env.SESSION_SECRET, token, destination);
	await record(c, token, "click", destination);

	if (signature && timingSafeEqual(signature, expected)) return c.redirect(destination, 302);

	return c.html(
		`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Leaving this site</title></head><body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem;"><h1 style="font-size:1.25rem">You are about to leave this site</h1><p>This link was not verified. It goes to:</p><p style="word-break:break-all;font-family:ui-monospace,monospace">${escapeHtml(destination)}</p><p><a href="${escapeHtml(destination)}" rel="noopener noreferrer nofollow">Continue</a></p></body></html>`,
		200,
		{ "Cache-Control": "no-store" },
	);
});

export default app;
