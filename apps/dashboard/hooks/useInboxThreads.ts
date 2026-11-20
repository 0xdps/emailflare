"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getThreads, type ThreadSummary, type ThreadView } from "@/lib/api";

interface Options {
	mailbox: string | null;
	view: ThreadView;
	search: string;
	initialThreads?: ThreadSummary[];
}

export function useInboxThreads({ mailbox, view, search, initialThreads }: Options) {
	const [threads, setThreads] = useState<ThreadSummary[]>(initialThreads ?? []);
	const [loading, setLoading] = useState(initialThreads === undefined);
	const [loadingMore, setLoadingMore] = useState(false);
	const [page, setPage] = useState(1);
	const [pages, setPages] = useState(1);
	const [total, setTotal] = useState(initialThreads?.length ?? 0);

	// The server pre-renders the default view, so skip the first fetch when it matches.
	const skipFetch = useRef(initialThreads !== undefined && !mailbox && view === "inbox" && !search);
	const requestId = useRef(0);

	const load = useCallback(
		async (nextPage: number, { silent = false }: { silent?: boolean } = {}) => {
			const id = ++requestId.current;
			if (nextPage === 1) {
				if (!silent) setLoading(true);
			} else {
				setLoadingMore(true);
			}
			try {
				const res = await getThreads({
					inbox: mailbox || undefined,
					search: search || undefined,
					view,
					page: nextPage,
				});
				if (id !== requestId.current) return;
				setThreads((prev) => (nextPage === 1 ? res.data : [...prev, ...res.data]));
				setPage(res.page ?? nextPage);
				setPages(res.pages ?? 1);
				setTotal(res.total ?? res.data.length);
			} catch {
				if (id === requestId.current && nextPage === 1) setThreads([]);
			} finally {
				if (id === requestId.current) {
					setLoading(false);
					setLoadingMore(false);
				}
			}
		},
		[mailbox, view, search],
	);

	useEffect(() => {
		if (skipFetch.current) {
			skipFetch.current = false;
			return;
		}
		const delay = search ? 250 : 0;
		const timer = setTimeout(() => load(1), delay);
		return () => clearTimeout(timer);
	}, [load, search]);

	const refresh = useCallback(() => load(1, { silent: true }), [load]);
	const loadMore = useCallback(() => {
		if (page < pages && !loadingMore) load(page + 1);
	}, [load, page, pages, loadingMore]);

	const patchThread = useCallback((id: string, patch: Partial<ThreadSummary>) => {
		setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
	}, []);

	const removeThread = useCallback((id: string) => {
		setThreads((prev) => prev.filter((t) => t.id !== id));
		setTotal((n) => Math.max(0, n - 1));
	}, []);

	return {
		threads,
		loading,
		loadingMore,
		hasMore: page < pages,
		total,
		refresh,
		loadMore,
		patchThread,
		removeThread,
	};
}
