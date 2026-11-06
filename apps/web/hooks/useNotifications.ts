"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@/lib/UserContext";

export interface NotificationMessage {
	type: string;
	emailId?: string;
	threadId?: string;
	personId?: string;
	inboxAddress?: string;
	from?: string;
	subject?: string;
	receivedAt?: string;
	[key: string]: unknown;
}

export function useNotifications(onNotification?: (msg: NotificationMessage) => void) {
	const { user } = useUser();
	const [connected, setConnected] = useState(false);
	const callbackRef = useRef(onNotification);
	callbackRef.current = onNotification;

	useEffect(() => {
		if (!user) {
			setConnected(false);
			return;
		}

		let socket: WebSocket | null = null;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		let closed = false;

		function connect() {
			if (closed) return;

			const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
			const wsUrl = `${protocol}//${window.location.host}/api/notifications/ws`;

			try {
				socket = new WebSocket(wsUrl);

				socket.onopen = () => {
					setConnected(true);
				};

				socket.onmessage = (event) => {
					try {
						const data = JSON.parse(event.data) as NotificationMessage;
						callbackRef.current?.(data);
					} catch {
						/* ignore non-json messages */
					}
				};

				socket.onclose = () => {
					setConnected(false);
					socket = null;
					if (!closed) {
						timeoutId = setTimeout(connect, 3000);
					}
				};

				socket.onerror = () => {
					socket?.close();
				};
			} catch {
				if (!closed) {
					timeoutId = setTimeout(connect, 5000);
				}
			}
		}

		connect();

		return () => {
			closed = true;
			if (timeoutId) clearTimeout(timeoutId);
			if (socket) socket.close();
		};
	}, [user]);

	return { connected };
}
