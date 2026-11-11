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

// Module-level persistent singleton socket
let sharedSocket: WebSocket | null = null;
let sharedConnected = false;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let currentUserId: string | null = null;

function nextReconnectDelay(): number {
	const base = Math.min(30_000, 1000 * 2 ** reconnectAttempt);
	reconnectAttempt += 1;
	return base + Math.floor(Math.random() * 400);
}
const listeners = new Set<(msg: NotificationMessage) => void>();
const statusListeners = new Set<(connected: boolean) => void>();

function notifyStatus(status: boolean) {
	sharedConnected = status;
	for (const fn of statusListeners) {
		try {
			fn(status);
		} catch {}
	}
}

function connectShared(userId: string) {
	if (
		sharedSocket &&
		(sharedSocket.readyState === WebSocket.OPEN || sharedSocket.readyState === WebSocket.CONNECTING)
	) {
		return;
	}

	currentUserId = userId;
	const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
	const host = typeof window !== "undefined" ? window.location.host : "localhost";
	const wsUrl = `${protocol}//${host}/api/notifications/ws`;

	try {
		sharedSocket = new WebSocket(wsUrl);

		sharedSocket.onopen = () => {
			reconnectAttempt = 0;
			notifyStatus(true);
		};

		sharedSocket.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data) as NotificationMessage;
				for (const listener of listeners) {
					try {
						listener(data);
					} catch {}
				}
			} catch {}
		};

		sharedSocket.onclose = () => {
			notifyStatus(false);
			sharedSocket = null;
			if (currentUserId) {
				if (reconnectTimeout) clearTimeout(reconnectTimeout);
				reconnectTimeout = setTimeout(() => {
					if (currentUserId) connectShared(currentUserId);
				}, nextReconnectDelay());
			}
		};

		sharedSocket.onerror = () => {
			sharedSocket?.close();
		};
	} catch {
		notifyStatus(false);
		if (reconnectTimeout) clearTimeout(reconnectTimeout);
		reconnectTimeout = setTimeout(() => {
			if (currentUserId) connectShared(currentUserId);
		}, nextReconnectDelay());
	}
}

function disconnectShared() {
	currentUserId = null;
	reconnectAttempt = 0;
	if (reconnectTimeout) clearTimeout(reconnectTimeout);
	if (sharedSocket) {
		sharedSocket.close();
		sharedSocket = null;
	}
	notifyStatus(false);
}

export function useNotifications(onNotification?: (msg: NotificationMessage) => void) {
	const { user } = useUser();
	const [connected, setConnected] = useState(sharedConnected);
	const callbackRef = useRef(onNotification);
	callbackRef.current = onNotification;

	useEffect(() => {
		const statusHandler = (status: boolean) => setConnected(status);
		statusListeners.add(statusHandler);
		setConnected(sharedConnected);

		if (user) {
			connectShared(user.id);
		} else {
			disconnectShared();
		}

		const messageHandler = (msg: NotificationMessage) => {
			callbackRef.current?.(msg);
		};
		listeners.add(messageHandler);

		return () => {
			listeners.delete(messageHandler);
			statusListeners.delete(statusHandler);
		};
	}, [user]);

	return { connected };
}
