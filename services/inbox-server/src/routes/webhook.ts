// POST /webhook/email — receives raw email from inbox-bridge CF Worker.
// Validates HMAC-SHA256 signature, then calls handleIncomingEmail().

import { Hono } from "hono";
import { handleIncomingEmail, type EmailPayload } from "../email-handler.js";
import { env } from "../env.js";

const webhook = new Hono();

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
	return Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

webhook.post("/email", async (c) => {
	const signature = c.req.header("X-Webhook-Signature");
	if (!signature) return c.json({ error: "Missing signature" }, 401);

	const body = await c.req.text();

	const expected = await hmacSha256Hex(env.WEBHOOK_SECRET, body);

	// Constant-time comparison to prevent timing attacks
	const sigBuf = new TextEncoder().encode(signature);
	const expBuf = new TextEncoder().encode(expected);
	if (sigBuf.length !== expBuf.length) return c.json({ error: "Invalid signature" }, 401);

	let mismatch = 0;
	for (let i = 0; i < sigBuf.length; i++) mismatch |= sigBuf[i] ^ expBuf[i];
	if (mismatch !== 0) return c.json({ error: "Invalid signature" }, 401);

	let payload: EmailPayload;
	try {
		payload = JSON.parse(body) as EmailPayload;
	} catch {
		return c.json({ error: "Invalid JSON" }, 400);
	}

	if (!payload.from || !payload.to || !payload.rawBase64) {
		return c.json({ error: "Missing required fields: from, to, rawBase64" }, 400);
	}

	await handleIncomingEmail(payload);
	return c.json({ ok: true });
});

export default webhook;

export { webhook };
