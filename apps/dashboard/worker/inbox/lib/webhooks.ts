import { generateId } from "@/lib/core";

export async function dispatchWebhooks(
	env: { DB: D1Database },
	event: string,
	payload: Record<string, unknown>,
): Promise<void> {
	const rows = await env.DB.prepare("SELECT id, url, secret, events FROM webhooks WHERE active = 1").all<{
		id: string;
		url: string;
		secret: string;
		events: string;
	}>();
	const body = JSON.stringify({ id: generateId(), event, created_at: new Date().toISOString(), data: payload });
	await Promise.all(
		(rows.results ?? []).map(async (hook) => {
			let events: string[] = [];
			try {
				const parsed = JSON.parse(hook.events);
				events = Array.isArray(parsed) ? parsed : [];
			} catch {
				events = [];
			}
			if (!events.includes(event) && !events.includes("*")) return;
			const key = await crypto.subtle.importKey(
				"raw",
				new TextEncoder().encode(hook.secret),
				{ name: "HMAC", hash: "SHA-256" },
				false,
				["sign"],
			);
			const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
			const signature = Array.from(new Uint8Array(mac))
				.map((b) => b.toString(16).padStart(2, "0"))
				.join("");
			await fetch(hook.url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-EmailFlare-Event": event,
					"X-EmailFlare-Signature": signature,
				},
				body,
			}).catch(() => undefined);
		}),
	);
}
