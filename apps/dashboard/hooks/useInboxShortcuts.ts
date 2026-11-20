"use client";

import { useEffect, useRef } from "react";

export interface InboxShortcutHandlers {
	compose: () => void;
	focusSearch: () => void;
	next: () => void;
	previous: () => void;
	archive: () => void;
	star: () => void;
	markUnread: () => void;
	reply: () => void;
	close: () => void;
	help: () => void;
}

function isTyping(target: EventTarget | null) {
	const el = target as HTMLElement | null;
	if (!el) return false;
	return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}

/** Single-key inbox shortcuts. Handlers are read through a ref so callers never re-bind the listener. */
export function useInboxShortcuts(handlers: InboxShortcutHandlers, enabled = true) {
	const ref = useRef(handlers);
	ref.current = handlers;

	useEffect(() => {
		if (!enabled) return;

		function onKeyDown(e: KeyboardEvent) {
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			if (isTyping(e.target)) return;
			// Leave open dialogs / menus alone (Escape may already have closed the popup by now,
			// so also check where the event came from).
			if (document.querySelector('[role="dialog"], [role="menu"]')) return;
			if ((e.target as HTMLElement | null)?.closest?.('[role="dialog"], [role="menu"], [role="menuitemradio"]'))
				return;

			const h = ref.current;
			const key = e.key;
			const run = (fn: () => void) => {
				e.preventDefault();
				fn();
			};

			switch (key) {
				case "c":
					return run(h.compose);
				case "/":
					return run(h.focusSearch);
				case "j":
				case "ArrowDown":
					return run(h.next);
				case "k":
				case "ArrowUp":
					return run(h.previous);
				case "e":
					return run(h.archive);
				case "s":
					return run(h.star);
				case "u":
					return run(h.markUnread);
				case "r":
					return run(h.reply);
				case "Escape":
					return run(h.close);
				case "?":
					return run(h.help);
			}
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [enabled]);
}
