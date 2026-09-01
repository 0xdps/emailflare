// Node.js WebSocket manager — replaces the NotificationsHub Durable Object.
// Uses the `ws` library attached to the same http.Server as Hono.
//
// Per-user map: userId → Set<WebSocket>
// The /api/notifications/ws upgrade path is handled by wsManager.handleUpgrade().

import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";

class WebSocketManager {
	private wss: WebSocketServer | null = null;
	private connections = new Map<string, Set<WebSocket>>();

	/** Attach to an existing http.Server (called once on startup). */
	attach(server: HttpServer): void {
		this.wss = new WebSocketServer({ noServer: true });

		this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
			// userId injected by the upgradeMiddleware below
			const userId = (req as IncomingMessage & { __userId?: string }).__userId;
			if (!userId) {
				ws.close(1008, "Unauthorized");
				return;
			}

			if (!this.connections.has(userId)) this.connections.set(userId, new Set());
			this.connections.get(userId)!.add(ws);

			ws.on("close", () => {
				const set = this.connections.get(userId);
				if (set) {
					set.delete(ws);
					if (set.size === 0) this.connections.delete(userId);
				}
			});

			ws.on("error", () => {
				const set = this.connections.get(userId);
				if (set) {
					set.delete(ws);
					if (set.size === 0) this.connections.delete(userId);
				}
			});

			// Respond to pings to keep connection alive
			ws.on("ping", () => ws.pong());
		});
	}

	/** Handle an HTTP upgrade request (called by server 'upgrade' event). */
	handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer, userId: string): void {
		if (!this.wss) throw new Error("WebSocketManager not attached to a server");
		(req as IncomingMessage & { __userId?: string }).__userId = userId;
		this.wss.handleUpgrade(req, socket, head, (ws) => {
			this.wss!.emit("connection", ws, req);
		});
	}

	/** Fan-out a notification JSON payload to all sockets for a user. */
	notifyUser(userId: string, payload: Record<string, unknown>): void {
		const sockets = this.connections.get(userId);
		if (!sockets || sockets.size === 0) return;
		const msg = JSON.stringify(payload);
		for (const ws of sockets) {
			if (ws.readyState === WebSocket.OPEN) {
				try {
					ws.send(msg);
				} catch {
					/* ignore send errors */
				}
			}
		}
	}

	/** Number of currently connected users. */
	connectedUsers(): number {
		return this.connections.size;
	}
}

export const wsManager = new WebSocketManager();
