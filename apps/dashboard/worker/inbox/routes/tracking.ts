// Public open pixel and click redirect. Tokens are issued only when a send opts into tracking.

import { Hono } from "hono";
import { generateId } from "@/lib/core";
import { dispatchWebhooks } from "../lib/webhooks.ts";
import type { HonoEnv } from "../env.ts";

const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));

const app = new Hono<HonoEnv>();

async function record(
	c: { env: HonoEnv["Bindings"]; executionCtx: { waitUntil(promise: Promise<unknown>): void } },
	token: string,
	kind: "open" | "click",
	url?: string,
) {
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

app.get("/o/:token", async (c) => {
	await record(c, c.req.param("token"), "open");
	return new Response(PIXEL, {
		headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
	});
});

app.get("/c/:token", async (c) => {
	const target = c.req.query("u") ?? "";
	let destination = "/";
	try {
		const url = new URL(target);
		if (url.protocol === "http:" || url.protocol === "https:") destination = url.toString();
	} catch {
		destination = "/";
	}
	await record(c, c.req.param("token"), "click", destination === "/" ? undefined : destination);
	return c.redirect(destination, 302);
});

export default app;
