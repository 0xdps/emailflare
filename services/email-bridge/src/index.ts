// emailflare-api-bridge
//
// Thin Cloudflare Worker — the only export is the email() handler.
// Receives inbound email (bounces / complaints) via CF Email Routing and
// forwards the raw bytes to the Node.js email-server bounce webhook.
//
// No D1 / KV / R2 / Queue / DO bindings needed — only two secrets:
//   EMAIL_SERVER_URL — base URL of your email-server  (e.g. https://api.example.com)
//   WEBHOOK_SECRET   — shared Bearer token (matches email-server's WEBHOOK_SECRET env var)

interface Env {
	EMAIL_SERVER_URL: string;
	WEBHOOK_SECRET: string;
}

export default {
	async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
		// Read the raw email bytes once — streams can only be consumed once
		const rawBytes = await new Response(message.raw).arrayBuffer();

		const serverUrl = env.EMAIL_SERVER_URL.replace(/\/$/, "");
		const res = await fetch(`${serverUrl}/api/webhooks/bounce`, {
			method: "POST",
			headers: {
				"Content-Type": "message/rfc822",
				Authorization: `Bearer ${env.WEBHOOK_SECRET}`,
			},
			body: rawBytes,
		});

		if (!res.ok) {
			// Throw so CF Email Workers retries the delivery
			throw new Error(`email-server webhook returned ${res.status}`);
		}
	},
} satisfies ExportedHandler<Env>;
