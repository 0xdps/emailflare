"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { Inbox as InboxIcon, MailPlus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ThreadSummary, ThreadView } from "@/lib/api";
import { dateBucket, type DateBucket } from "@/lib/inbox/format";
import { cn } from "@/lib/utils";
import ThreadRow, { type ThreadActions } from "./ThreadRow";

interface ThreadListProps extends ThreadActions {
	title: string;
	threads: ThreadSummary[];
	total: number;
	selectedId: string | null;
	onSelectThread: (id: string) => void;
	search: string;
	onSearchChange: (value: string) => void;
	view: ThreadView;
	onToggleUnread: (unreadOnly: boolean) => void;
	loading: boolean;
	loadingMore: boolean;
	hasMore: boolean;
	onLoadMore: () => void;
	hasMailbox: boolean;
	showMailbox: boolean;
	onCompose: () => void;
	className?: string;
}

function RowSkeleton() {
	return (
		<div className="flex gap-3 border-b px-4 py-3">
			<Skeleton className="size-8 shrink-0 rounded-full" />
			<div className="flex-1 space-y-2">
				<Skeleton className="h-3.5 w-2/5" />
				<Skeleton className="h-3.5 w-4/5" />
				<Skeleton className="h-3 w-3/5" />
			</div>
		</div>
	);
}

export default function ThreadList({
	title,
	threads,
	total,
	selectedId,
	onSelectThread,
	search,
	onSearchChange,
	view,
	onToggleUnread,
	loading,
	loadingMore,
	hasMore,
	onLoadMore,
	hasMailbox,
	showMailbox,
	onCompose,
	className,
	...actions
}: ThreadListProps) {
	const sentinel = useRef<HTMLDivElement>(null);
	const canFilterUnread = view === "inbox" || view === "unread";

	useEffect(() => {
		const el = sentinel.current;
		if (!el || !hasMore) return;
		const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && onLoadMore(), {
			rootMargin: "240px",
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, [hasMore, onLoadMore, threads.length]);

	// Keep the keyboard-selected row in view.
	useEffect(() => {
		if (!selectedId) return;
		document.querySelector(`[data-thread-id="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: "nearest" });
	}, [selectedId]);

	const sections = useMemo(() => {
		const out: Array<{ label: DateBucket; items: ThreadSummary[] }> = [];
		for (const thread of threads) {
			const label = dateBucket(thread.last_message_at);
			const last = out[out.length - 1];
			if (last?.label === label) last.items.push(thread);
			else out.push({ label, items: [thread] });
		}
		return out;
	}, [threads]);

	return (
		<section className={cn("flex h-full min-h-0 flex-col bg-card", className)} aria-label={title}>
			<header className="shrink-0 space-y-3 border-b p-4 pb-3">
				<div className="flex items-baseline justify-between gap-2">
					<h1 className="truncate text-base font-semibold">{title}</h1>
					<span className="text-2xs text-muted-foreground tabular-nums">
						{loading ? "" : `${total} ${total === 1 ? "thread" : "threads"}`}
					</span>
				</div>

				<InputGroup>
					<InputGroupAddon>
						<Search />
					</InputGroupAddon>
					<InputGroupInput
						id="thread-search-input"
						value={search}
						onChange={(e) => onSearchChange(e.target.value)}
						onKeyDown={(e) => e.key === "Escape" && (e.currentTarget.blur(), onSearchChange(""))}
						placeholder="Search mail"
						aria-label="Search threads"
					/>
					<InputGroupAddon align="inline-end">
						{search ? (
							<InputGroupButton
								size="icon-xs"
								aria-label="Clear search"
								onClick={() => onSearchChange("")}
							>
								<X />
							</InputGroupButton>
						) : (
							<Kbd>/</Kbd>
						)}
					</InputGroupAddon>
				</InputGroup>

				{canFilterUnread && (
					<ToggleGroup
						value={[view === "unread" ? "unread" : "all"]}
						onValueChange={(v) => v[0] && onToggleUnread(v[0] === "unread")}
						variant="outline"
						size="sm"
						spacing={0}
					>
						<ToggleGroupItem value="all">All</ToggleGroupItem>
						<ToggleGroupItem value="unread">Unread</ToggleGroupItem>
					</ToggleGroup>
				)}
			</header>

			<div role="listbox" aria-label="Threads" className="min-h-0 flex-1 overflow-y-auto">
				{loading ? (
					Array.from({ length: 7 }).map((_, i) => <RowSkeleton key={i} />)
				) : threads.length === 0 ? (
					<Empty className="h-full">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<InboxIcon />
							</EmptyMedia>
							<EmptyTitle>
								{search
									? "No matches"
									: view === "unread"
										? "You're all caught up"
										: `Nothing in ${title.toLowerCase()}`}
							</EmptyTitle>
							<EmptyDescription>
								{search
									? `No threads match “${search}”.`
									: !hasMailbox
										? "Add a mailbox in Admin to start receiving mail."
										: view === "inbox" || view === "unread"
											? "New conversations will appear here the moment they arrive."
											: "Threads you move here show up in this view."}
							</EmptyDescription>
						</EmptyHeader>
						{!search && hasMailbox && (view === "inbox" || view === "unread") && (
							<EmptyContent>
								<Button size="sm" onClick={onCompose}>
									<MailPlus /> Compose
								</Button>
							</EmptyContent>
						)}
					</Empty>
				) : (
					<>
						{sections.map((section) => (
							<div key={section.label}>
								<div className="sticky top-0 z-10 border-b bg-card/95 px-4 py-1.5 text-2xs font-medium tracking-wide text-muted-foreground uppercase backdrop-blur">
									{section.label}
								</div>
								{section.items.map((thread) => (
									<ThreadRow
										key={thread.id}
										thread={thread}
										selected={thread.id === selectedId}
										showMailbox={showMailbox}
										onSelect={onSelectThread}
										{...actions}
									/>
								))}
							</div>
						))}
						<div ref={sentinel} className="flex h-12 items-center justify-center">
							{loadingMore && <Spinner className="text-muted-foreground" />}
						</div>
					</>
				)}
			</div>
		</section>
	);
}
