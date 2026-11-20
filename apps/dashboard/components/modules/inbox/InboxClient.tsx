"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Keyboard, Mail } from "lucide-react";
import { toast } from "sonner";
import {
	getInboxes,
	getThreadDetails,
	composeSend,
	markThreadRead,
	markThreadUnread,
	replyTo,
	setThreadState,
	type Inbox as InboxType,
	type Thread,
	type ThreadSummary,
	type ThreadView,
} from "@/lib/api";
import { useNotifications } from "@/hooks/useNotifications";
import { useInboxThreads } from "@/hooks/useInboxThreads";
import { useInboxShortcuts } from "@/hooks/useInboxShortcuts";
import { invalidateThreadCounts } from "@/hooks/useThreadCounts";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePermissions } from "@/lib/UserContext";
import { replyReferences } from "@/lib/threading";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { useDefaultLayout } from "react-resizable-panels";
import OwnerAccessBanner from "@/components/OwnerAccessBanner";
import ComposeModal from "./ComposeModal";
import type { ReplyPayload } from "./InlineComposer";
import ShortcutsDialog from "./ShortcutsDialog";
import TestInboxFolderView from "./TestInboxFolderView";
import ThreadList from "./ThreadList";
import ThreadReader from "./ThreadReader";

interface InboxClientProps {
	initialThreads?: ThreadSummary[];
	initialInboxes?: InboxType[];
}

const VIEW_TITLES: Record<ThreadView, string> = {
	inbox: "Inbox",
	unread: "Inbox",
	starred: "Starred",
	archived: "Archived",
};

function parseView(raw: string | null): ThreadView {
	return raw === "starred" || raw === "archived" || raw === "unread" ? raw : "inbox";
}

function ReaderSkeleton() {
	return (
		<div className="flex h-full flex-col gap-4 p-6">
			<Skeleton className="h-6 w-2/3" />
			<Skeleton className="h-4 w-1/3" />
			<Skeleton className="mt-4 h-40 w-full rounded-xl" />
			<Skeleton className="h-24 w-full rounded-xl" />
		</div>
	);
}

export default function InboxClient({ initialThreads, initialInboxes }: InboxClientProps) {
	const params = useSearchParams();
	const { canAccessTester, canAccessInbox } = usePermissions();
	const isMobile = useIsMobile();

	const mailbox = params.get("mailbox");
	const baseView = parseView(params.get("view"));
	const showTestFolder = canAccessTester && (params.get("folder") === "test" || !canAccessInbox);

	const [search, setSearch] = useState("");
	const [unreadOnly, setUnreadOnly] = useState(baseView === "unread");
	const view: ThreadView = baseView === "inbox" && unreadOnly ? "unread" : baseView;

	const [inboxes, setInboxes] = useState<InboxType[]>(initialInboxes ?? []);
	const [composeOpen, setComposeOpen] = useState(false);
	const [shortcutsOpen, setShortcutsOpen] = useState(false);
	const [replySignal, setReplySignal] = useState(0);

	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [thread, setThread] = useState<Thread | null>(null);
	const [loadingThread, setLoadingThread] = useState(false);

	const list = useInboxThreads({ mailbox, view, search, initialThreads });
	const { threads, patchThread, removeThread, refresh } = list;

	const summaryCache = useRef(new Map<string, ThreadSummary>());
	for (const t of threads) summaryCache.current.set(t.id, t);
	const selectedSummary = selectedId
		? (threads.find((t) => t.id === selectedId) ?? summaryCache.current.get(selectedId) ?? null)
		: null;

	const threadsRef = useRef(threads);
	threadsRef.current = threads;
	const selectedRef = useRef(selectedId);
	selectedRef.current = selectedId;

	// Selection belongs to a view; leaving the view clears it.
	useEffect(() => {
		setSelectedId(null);
		setThread(null);
		setUnreadOnly(parseView(params.get("view")) === "unread");
		setSearch("");
	}, [mailbox, baseView]);

	useEffect(() => {
		if (initialInboxes === undefined) {
			getInboxes()
				.then(setInboxes)
				.catch(() => {});
		}
	}, [initialInboxes]);

	useEffect(() => {
		const open = () => setComposeOpen(true);
		window.addEventListener("emailflare:compose", open);
		return () => window.removeEventListener("emailflare:compose", open);
	}, []);

	const selectThread = useCallback(async (id: string) => {
		setSelectedId(id);
		setLoadingThread(true);
		try {
			const detail = await getThreadDetails(id);
			if (selectedRef.current !== id) return;
			setThread(detail);
			const summary = threadsRef.current.find((t) => t.id === id);
			if (summary && summary.unread_count > 0) {
				patchThread(id, { unread_count: 0 });
				markThreadRead(id)
					.then(invalidateThreadCounts)
					.catch(() => {});
			}
		} catch {
			if (selectedRef.current === id) toast.error("Couldn't open that thread.");
		} finally {
			if (selectedRef.current === id) setLoadingThread(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Deep link: /inbox?thread=<id> (used by notifications).
	useEffect(() => {
		const id = params.get("thread");
		if (id) selectThread(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useNotifications((msg) => {
		if (msg.type !== "new_email") return;
		refresh();
		const current = selectedRef.current;
		if (current && msg.threadId === current) {
			getThreadDetails(current)
				.then(setThread)
				.catch(() => {});
		}
	});

	const closeThread = useCallback(() => {
		setSelectedId(null);
		setThread(null);
	}, []);

	const step = useCallback(
		(delta: 1 | -1) => {
			const list = threadsRef.current;
			if (list.length === 0) return;
			const idx = list.findIndex((t) => t.id === selectedRef.current);
			const next = idx === -1 ? 0 : Math.min(Math.max(idx + delta, 0), list.length - 1);
			selectThread(list[next].id);
		},
		[selectThread],
	);

	const toggleStar = useCallback(
		async (t: ThreadSummary) => {
			const next = !t.is_starred;
			patchThread(t.id, { is_starred: next });
			try {
				await setThreadState(t.id, { starred: next });
				invalidateThreadCounts();
			} catch {
				patchThread(t.id, { is_starred: !next });
				toast.error("Couldn't update the star.");
			}
		},
		[patchThread],
	);

	const toggleArchive = useCallback(
		async (t: ThreadSummary) => {
			const next = !t.is_archived;
			// Inbox / Unread hide archived threads and Archived hides the rest, so the row leaves the list.
			const leavesView = view === "archived" ? !next : view !== "starred" ? next : false;

			if (leavesView) {
				if (selectedRef.current === t.id) {
					const list = threadsRef.current;
					const idx = list.findIndex((x) => x.id === t.id);
					const neighbour = list[idx + 1] ?? list[idx - 1];
					if (neighbour && !isMobile) selectThread(neighbour.id);
					else closeThread();
				}
				removeThread(t.id);
			} else {
				patchThread(t.id, { is_archived: next });
			}

			try {
				await setThreadState(t.id, { archived: next });
				invalidateThreadCounts();
				toast(next ? "Thread archived" : "Moved to inbox", {
					action: {
						label: "Undo",
						onClick: () => {
							setThreadState(t.id, { archived: !next })
								.then(() => {
									invalidateThreadCounts();
									refresh();
								})
								.catch(() => toast.error("Couldn't undo."));
						},
					},
				});
			} catch {
				toast.error("Couldn't update the thread.");
				refresh();
			}
		},
		[view, isMobile, selectThread, closeThread, removeThread, patchThread, refresh],
	);

	const toggleRead = useCallback(
		async (t: ThreadSummary) => {
			const makeUnread = t.unread_count === 0;
			patchThread(t.id, { unread_count: makeUnread ? 1 : 0 });
			if (makeUnread && selectedRef.current === t.id) closeThread();
			try {
				await (makeUnread ? markThreadUnread(t.id) : markThreadRead(t.id));
				invalidateThreadCounts();
			} catch {
				patchThread(t.id, { unread_count: makeUnread ? 0 : t.unread_count });
				toast.error("Couldn't update the thread.");
			}
		},
		[patchThread, closeThread],
	);

	async function handleReplySend(payload: ReplyPayload) {
		if (!selectedSummary) return;
		if (payload.replyTarget?.message_id) {
			await replyTo({
				personId: selectedSummary.person_id || "",
				to: payload.to,
				from: payload.from,
				subject: payload.subject,
				text: payload.text,
				replyToMessageId: payload.replyTarget.message_id,
				references: replyReferences(payload.replyTarget),
			});
		} else {
			await composeSend({
				to: payload.to,
				from: payload.from,
				subject: payload.subject,
				text: payload.text,
				personId: selectedSummary.person_id || undefined,
			});
		}
		setThread(await getThreadDetails(selectedSummary.id));
		refresh();
	}

	async function handleModalSend(payload: {
		from: string;
		to: string;
		subject: string;
		text: string;
		attachments?: Array<{ filename: string; content: string; type: string }>;
	}) {
		const result = await composeSend(payload);
		refresh();
		if (result.threadId) selectThread(result.threadId);
	}

	const selected = () => threadsRef.current.find((t) => t.id === selectedRef.current);
	useInboxShortcuts(
		{
			compose: () => setComposeOpen(true),
			focusSearch: () => document.getElementById("thread-search-input")?.focus(),
			next: () => step(1),
			previous: () => step(-1),
			archive: () => selected() && toggleArchive(selected()!),
			star: () => selected() && toggleStar(selected()!),
			markUnread: () => selected() && toggleRead(selected()!),
			reply: () => selectedRef.current && setReplySignal((n) => n + 1),
			close: closeThread,
			help: () => setShortcutsOpen(true),
		},
		!showTestFolder,
	);

	const title = mailbox ? inboxes.find((i) => i.email === mailbox)?.display_name || mailbox : VIEW_TITLES[baseView];
	const unreadTotal = threads.reduce((n, t) => n + (t.unread_count > 0 ? 1 : 0), 0);

	// Panel sizes are persisted per browser; mount the group client-side to avoid a hydration mismatch.
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const { defaultLayout, onLayoutChanged } = useDefaultLayout({
		id: "emailflare-inbox",
		storage: typeof window === "undefined" ? { getItem: () => null, setItem: () => {} } : window.localStorage,
	});

	const listPane = (
		<ThreadList
			title={title}
			threads={threads}
			total={list.total}
			selectedId={selectedId}
			onSelectThread={selectThread}
			search={search}
			onSearchChange={setSearch}
			view={view}
			onToggleUnread={setUnreadOnly}
			loading={list.loading}
			loadingMore={list.loadingMore}
			hasMore={list.hasMore}
			onLoadMore={list.loadMore}
			hasMailbox={inboxes.length > 0}
			showMailbox={!mailbox && inboxes.length > 1}
			onCompose={() => setComposeOpen(true)}
			onToggleStar={toggleStar}
			onToggleArchive={toggleArchive}
			onToggleRead={toggleRead}
		/>
	);

	const readerPane =
		loadingThread && !thread ? (
			<ReaderSkeleton />
		) : selectedSummary && thread ? (
			<ThreadReader
				summary={selectedSummary}
				thread={thread}
				inboxes={inboxes}
				replySignal={replySignal}
				onReplySend={handleReplySend}
				onToggleStar={() => toggleStar(selectedSummary)}
				onToggleArchive={() => toggleArchive(selectedSummary)}
				onMarkUnread={() => toggleRead(selectedSummary)}
				onBack={closeThread}
			/>
		) : (
			<Empty className="h-full bg-muted/30">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Mail />
					</EmptyMedia>
					<EmptyTitle>
						{unreadTotal > 0
							? `${unreadTotal} unread ${unreadTotal === 1 ? "thread" : "threads"}`
							: "Select a conversation"}
					</EmptyTitle>
					<EmptyDescription>
						Pick a thread from the list to read it, or press C to start a new message.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button variant="outline" size="sm" onClick={() => setShortcutsOpen(true)}>
						<Keyboard /> Keyboard shortcuts
					</Button>
				</EmptyContent>
			</Empty>
		);

	return (
		<div className="flex h-full flex-col overflow-hidden bg-background">
			<OwnerAccessBanner />

			<div className="min-h-0 flex-1">
				{showTestFolder ? (
					<TestInboxFolderView />
				) : isMobile ? (
					selectedId ? (
						readerPane
					) : (
						listPane
					)
				) : mounted ? (
					<ResizablePanelGroup
						orientation="horizontal"
						defaultLayout={defaultLayout}
						onLayoutChanged={onLayoutChanged}
					>
						<ResizablePanel id="list" defaultSize="34%" minSize={300} maxSize="55%">
							{listPane}
						</ResizablePanel>
						<ResizableHandle />
						<ResizablePanel id="reader" minSize="35%">
							{readerPane}
						</ResizablePanel>
					</ResizablePanelGroup>
				) : (
					<div className="flex h-full">
						<div className="w-[34%] min-w-[300px] border-r">{listPane}</div>
						<div className="min-w-0 flex-1">{readerPane}</div>
					</div>
				)}
			</div>

			<ComposeModal
				open={composeOpen}
				onOpenChange={setComposeOpen}
				inboxes={inboxes}
				defaultFrom={mailbox ?? undefined}
				onSend={handleModalSend}
			/>
			<ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
		</div>
	);
}
