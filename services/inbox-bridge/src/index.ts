// emailflare-inbox-bridge
//
// Thin Cloudflare Worker — the only export is the email() handler.
// Receives inbound email, signs the raw payload with HMAC-SHA256, and
// forwards it to the Node.js inbox-server via a webhook POST.
//
// No D1 / KV / R2 / Queue / DO bindings — only two secrets:
//   INBOX_SERVER_URL     — base URL of your inbox-server
//   INBOX_WEBHOOK_SECRET — shared HMAC key for webhook signature

interface Env {
	INBOX_SERVER_URL: string;
	INBOX_WEBHOOK_SECRET: string;
}

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

export default {
	async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
		// Read the raw email bytes once — readable streams can only be consumed once
		const rawBytes = await new Response(message.raw).arrayBuffer();

		// Encode as base64 so we can embed in JSON without corruption
		const rawBase64 = btoa(String.fromCharCode(...new Uint8Array(rawBytes)));

		const payload = JSON.stringify({
			from: message.from,
			to: message.to,
			rawBase64,
			spf: message.headers.get("Authentication-Results-SPF") ?? null,
			dkim: message.headers.get("Authentication-Results-DKIM") ?? null,
			dmarc: message.headers.get("Authentication-Results-DMARC") ?? null,
		});

		const signature = await hmacSha256Hex(env.INBOX_WEBHOOK_SECRET, payload);

		const serverUrl = env.INBOX_SERVER_URL.replace(/\/$/, "");
		const res = await fetch(`${serverUrl}/webhook/email`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Webhook-Signature": signature,
			},
			body: payload,
		});

		if (!res.ok) {
			// Throw so the email is retried by Cloudflare Email Workers
			throw new Error(`inbox-server webhook returned ${res.status}`);
		}
	},
} satisfies ExportedHandler<Env>;
