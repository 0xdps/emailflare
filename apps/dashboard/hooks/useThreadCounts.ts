"use client";

import { useCallback, useEffect, useState } from "react";
import { getThreadCounts, type ThreadCounts } from "@/lib/api";
import { useNotifications } from "@/hooks/useNotifications";

export const COUNTS_CHANGED_EVENT = "emailflare:counts-changed";

/** Ask every mounted useThreadCounts() to refetch (call after read/archive/star changes). */
export function invalidateThreadCounts() {
	if (typeof window !== "undefined") window.dispatchEvent(new Event(COUNTS_CHANGED_EVENT));
}

const EMPTY: ThreadCounts = { unread: 0, starred: 0, perInbox: {} };

export function useThreadCounts(enabled = true): ThreadCounts {
	const [counts, setCounts] = useState<ThreadCounts>(EMPTY);

	const refresh = useCallback(() => {
		if (!enabled) return;
		getThreadCounts()
			.then(setCounts)
			.catch(() => {});
	}, [enabled]);

	useEffect(() => {
		refresh();
		window.addEventListener(COUNTS_CHANGED_EVENT, refresh);
		return () => window.removeEventListener(COUNTS_CHANGED_EVENT, refresh);
	}, [refresh]);

	useNotifications((msg) => {
		if (msg.type === "new_email") refresh();
	});

	return counts;
}
