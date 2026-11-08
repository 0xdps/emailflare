"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Mail, Inbox as InboxIcon, PenLine, Loader2, Keyboard, ArrowRight, Sparkles, Search } from "lucide-react";
import {
	Thread,
	ThreadItem,
	ThreadSummary,
	Inbox as InboxType,
	getThreads,
	getThreadDetails,
	composeSend,
	replyTo,
	markThreadRead,
	getInboxes,
} from "@/lib/api";
import { useNotifications } from "@/hooks/useNotifications";
import { usePermissions } from "@/lib/UserContext";
import InboxNav from "./InboxNav";
import ThreadList from "./ThreadList";
import ThreadReader from "./ThreadReader";
import ComposeModal from "./ComposeModal";
import TestInboxFolderView from "./TestInboxFolderView";
import OwnerAccessBanner from "@/components/OwnerAccessBanner";
import { cn } from "@/lib/utils";

interface InboxClientProps {
	initialThreads?: ThreadSummary[];
	initialInboxes?: InboxType[];
}

export default function InboxClient({ initialThreads, initialInboxes }: InboxClientProps) {
	const { canAccessTester, canAccessInbox } = usePermissions();
	const [activeFolder, setActiveFolder] = useState<"inbox" | "test">("inbox");
	const [selectedInbox, setSelectedInbox] = useState<string | null>(null);

	const [threads, setThreads] = useState<ThreadSummary[]>(initialThreads ?? []);
	const [inboxes, setInboxes] = useState<InboxType[]>(initialInboxes ?? []);
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<"all" | "unread">("all");

	const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
	const [thread, setThread] = useState<Thread | null>(null);
	const [loadingThreads, setLoadingThreads] = useState(initialThreads === undefined);
	const [loadingThread, setLoadingThread] = useState(false);

	const [composeOpen, setComposeOpen] = useState(false);

	// Refs for keyboard shortcuts to avoid stale closures
	const selectedThreadIdRef = useRef<string | null>(selectedThreadId);
	selectedThreadIdRef.current = selectedThreadId;

	const threadsRef = useRef<ThreadSummary[]>(threads);
	threadsRef.current = threads;

	// Sync folder from URL if provided (e.g. ?folder=test) or default to test for tester-only
	useEffect(() => {
		if (typeof window !== "undefined") {
			const params = new URLSearchParams(window.location.search);
			const folder = params.get("folder");
			if (folder === "test" && canAccessTester) {
				setActiveFolder("test");
			} else if (!canAccessInbox && canAccessTester) {
				setActiveFolder("test");
			}
		}
	}, [canAccessTester, canAccessInbox]);

	// Select a conversation thread
	const selectThread = useCallback(async (id: string) => {
		setSelectedThreadId(id);
		setLoadingThread(true);
		try {
			const t = await getThreadDetails(id);
			setThread(t);
			await markThreadRead(id).catch(() => {});
			setThreads((prev) => prev.map((item) => (item.id === id ? { ...item, unread_count: 0 } : item)));
		} finally {
			setLoadingThread(false);
		}
	}, []);

	// Load conversation threads
	const fetchThreads = useCallback(async () => {
		setLoadingThreads(true);
		try {
			const { data } = await getThreads({
				inbox: selectedInbox || undefined,
				search: search || undefined,
				unread: filter === "unread" ? true : undefined,
			});
			setThreads(data);

			// On desktop (>= 768px), auto-select first thread if none selected
			const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;
			if (data.length > 0 && !selectedThreadIdRef.current && isDesktop) {
				selectThread(data[0].id);
			}
		} catch {
			setThreads([]);
		} finally {
			setLoadingThreads(false);
		}
	}, [selectedInbox, search, filter, selectThread]);

	useEffect(() => {
		fetchThreads();
	}, [selectedInbox, search, filter, fetchThreads]);

	useEffect(() => {
		if (initialInboxes === undefined) {
			getInboxes()
				.then(setInboxes)
				.catch(() => {});
		}
	}, [initialInboxes]);

	// Live notifications wakeup
	useNotifications((msg) => {
		if (msg.type === "new_email") {
			fetchThreads();
			if (selectedThreadId && msg.threadId === selectedThreadId) {
				getThreadDetails(selectedThreadId)
					.then(setThread)
					.catch(() => {});
			}
		}
	});

	const selectedThread = threads.find((t) => t.id === selectedThreadId) || null;

	// Handle sending an inline reply
	async function handleReplySend(payload: {
		from: string;
		to: string;
		subject: string;
		text: string;
		replyTarget?: ThreadItem | null;
	}) {
		if (!selectedThread) return;

		if (payload.replyTarget?.message_id) {
			await replyTo({
				personId: selectedThread.person_id || "",
				to: payload.to,
				from: payload.from,
				subject: payload.subject,
				text: payload.text,
				replyToMessageId: payload.replyTarget.message_id,
			});
		} else {
			await composeSend({
				to: payload.to,
				from: payload.from,
				subject: payload.subject,
				text: payload.text,
				personId: selectedThread.person_id || undefined,
			});
		}

		// Refresh thread
		const updated = await getThreadDetails(selectedThread.id);
		setThread(updated);
		fetchThreads();
	}

	// Handle new compose from modal
	async function handleModalSend(payload: { from: string; to: string; subject: string; text: string }) {
		const result = await composeSend(payload);
		fetchThreads();
		if (result.threadId) {
			selectThread(result.threadId);
		}
	}

	// Global keyboard shortcuts (C, J, K, ArrowDown, ArrowUp, /)
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			// Don't intercept if user is typing in input or textarea
			const activeTag = document.activeElement?.tagName.toLowerCase();
			if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
				return;
			}

			// Don't intercept if modifier keys like Cmd/Ctrl are pressed (except for browser defaults)
			if (e.metaKey || e.ctrlKey || e.altKey) {
				return;
			}

			if (e.key === "c" || e.key === "C") {
				e.preventDefault();
				setComposeOpen(true);
			} else if (e.key === "/") {
				e.preventDefault();
				const searchInput = document.getElementById("thread-search-input");
				if (searchInput) {
					searchInput.focus();
				}
			} else if (e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
				e.preventDefault();
				const curThreads = threadsRef.current;
				if (curThreads.length === 0) return;
				const curId = selectedThreadIdRef.current;
				const idx = curThreads.findIndex((t) => t.id === curId);
				const nextIdx = idx === -1 ? 0 : Math.min(idx + 1, curThreads.length - 1);
				selectThread(curThreads[nextIdx].id);
			} else if (e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
				e.preventDefault();
				const curThreads = threadsRef.current;
				if (curThreads.length === 0) return;
				const curId = selectedThreadIdRef.current;
				const idx = curThreads.findIndex((t) => t.id === curId);
				const prevIdx = idx === -1 ? 0 : Math.max(idx - 1, 0);
				selectThread(curThreads[prevIdx].id);
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectThread]);

	const unreadTotal = threads.reduce((acc, t) => acc + (t.unread_count || 0), 0);

	return (
		<div className="flex flex-col h-full overflow-hidden bg-background">
			<OwnerAccessBanner />

			<div className="flex flex-1 min-h-0 overflow-hidden">
				{/* ── Pane 1: Mailbox & Folder Navigation (Desktop: 200px) ── */}
				<InboxNav
					inboxes={inboxes}
					selectedInbox={selectedInbox}
					onSelectInbox={setSelectedInbox}
					activeFolder={activeFolder}
					onSelectFolder={setActiveFolder}
					canAccessInbox={canAccessInbox}
					canAccessTester={canAccessTester}
					unreadTotal={unreadTotal}
					onComposeClick={() => setComposeOpen(true)}
					className="hidden md:flex w-[200px] shrink-0"
				/>

				{/* ── Condition: Test Mailbox Folder Selected ── */}
				{activeFolder === "test" ? (
					<div className="flex-1 min-w-0 h-full overflow-hidden">
						<TestInboxFolderView />
					</div>
				) : (
					/* ── Standard 3-Pane View (Thread List + Reader) ── */
					<>
						{/* ── Pane 2: Conversation Thread List ── */}
						<ThreadList
							threads={threads}
							selectedId={selectedThreadId}
							onSelectThread={selectThread}
							search={search}
							onSearchChange={setSearch}
							filter={filter}
							onFilterChange={setFilter}
							loading={loadingThreads}
							className={cn("w-full md:w-[320px] shrink-0", selectedThreadId ? "hidden md:flex" : "flex")}
						/>

						{/* ── Pane 3: Conversation Reader & Composer (Flex-1) ── */}
						<div
							className={cn(
								"flex-1 min-w-0 h-full overflow-hidden bg-background",
								!selectedThreadId ? "hidden md:flex" : "flex",
							)}
						>
							{loadingThread ? (
								<div className="flex items-center justify-center h-full w-full">
									<Loader2 size={24} className="animate-spin text-muted-foreground" />
								</div>
							) : selectedThread && thread ? (
								<ThreadReader
									person={{
										name: selectedThread.counterparty_name,
										email: selectedThread.counterparty_email,
										unread_count: selectedThread.unread_count,
									}}
									thread={thread}
									inboxes={inboxes}
									onReplySend={handleReplySend}
									onBack={() => setSelectedThreadId(null)}
									onMarkUnread={() => {
										setThreads((prev) =>
											prev.map((t) =>
												t.id === selectedThread.id ? { ...t, unread_count: 1 } : t,
											),
										);
									}}
								/>
							) : (
								<div className="flex flex-col items-center justify-center h-full w-full text-center p-8 select-none">
									<div className="size-12 rounded-2xl bg-orange-50 dark:bg-orange-950/60 flex items-center justify-center text-orange-600 mb-4">
										<Mail size={24} strokeWidth={1.5} />
									</div>
									<h2 className="text-sm font-semibold text-foreground mb-1">Select a thread</h2>
									<p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
										Choose a thread from the list on the left to read messages, view communication
										history, and send replies.
									</p>

									{/* Keyboard Shortcuts Hint Card */}
									<div className="rounded-xl border border-border/80 bg-muted/20 p-4 max-w-xs w-full text-left space-y-2.5">
										<div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
											<Keyboard size={12} />
											<span>Keyboard shortcuts</span>
										</div>
										<div className="space-y-2 text-xs text-foreground/80">
											<div className="flex items-center justify-between">
												<span>Compose message</span>
												<kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px]">
													C
												</kbd>
											</div>
											<div className="flex items-center justify-between">
												<span>Next / Prev thread</span>
												<div className="flex items-center gap-1">
													<kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px]">
														J
													</kbd>
													<kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px]">
														K
													</kbd>
												</div>
											</div>
											<div className="flex items-center justify-between">
												<span>Search threads</span>
												<kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px]">
													/
												</kbd>
											</div>
											<div className="flex items-center justify-between">
												<span>Command palette</span>
												<kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px]">
													⌘ + K
												</kbd>
											</div>
											<div className="flex items-center justify-between">
												<span>Send reply</span>
												<kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px]">
													⌘ + Enter
												</kbd>
											</div>
										</div>
									</div>
								</div>
							)}
						</div>
					</>
				)}
			</div>

			{/* ── Standalone Compose Modal (Shortcut 'C') ── */}
			<ComposeModal open={composeOpen} onOpenChange={setComposeOpen} inboxes={inboxes} onSend={handleModalSend} />
		</div>
	);
}
