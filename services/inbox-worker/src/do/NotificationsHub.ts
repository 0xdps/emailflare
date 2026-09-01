// NotificationsHub Durable Object
// Per-user persistent WebSocket connection hub.
// Receives notifications from email-handler and fan-outs to connected clients.

import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env.ts";

interface NotificationPayload {
	type: string;
	[key: string]: unknown;
}

export class NotificationsHub extends DurableObject<Env> {
	private sockets = new Set<WebSocket>();

	// Called by email-handler.ts when a new email arrives
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// WebSocket upgrade from browser
		if (request.headers.get("Upgrade") === "websocket") {
			const pair = new WebSocketPair();
			const [client, server] = Object.values(pair);
			this.ctx.acceptWebSocket(server);
			this.sockets.add(server);
			server.addEventListener("close", () => this.sockets.delete(server));
			return new Response(null, { status: 101, webSocket: client });
		}

		// POST /notify — internal push from email-handler
		if (url.pathname === "/notify" && request.method === "POST") {
			const payload = await request.json<NotificationPayload>();
			const msg = JSON.stringify(payload);
			for (const ws of this.sockets) {
				try {
					ws.send(msg);
				} catch {
					this.sockets.delete(ws);
				}
			}
			return new Response("ok");
		}

		return new Response("Not found", { status: 404 });
	}

	// Durable Object websocket message handler
	webSocketMessage(ws: WebSocket, _message: string | ArrayBuffer): void {
		// Ignore pings from client; keep-alive is handled by CF runtime
	}

	webSocketClose(ws: WebSocket): void {
		this.sockets.delete(ws);
	}

	webSocketError(ws: WebSocket): void {
		this.sockets.delete(ws);
	}
}
