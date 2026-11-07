"use client";

import React from "react";
import { Search, Mail, Loader2 } from "lucide-react";
import { ThreadSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ThreadListProps {
	threads: ThreadSummary[];
	selectedId: string | null;
	onSelectThread: (id: string) => void;
	search: string;
	onSearchChange: (val: string) => void;
	filter: "all" | "unread";
	onFilterChange: (val: "all" | "unread") => void;
	loading: boolean;
	className?: string;
}

function initials(name: string | null | undefined, email: string) {
	if (name) {
		const parts = name.trim().split(/\s+/);
		if (parts.length >= 2) {
			return (parts[0][0] + parts[1][0]).toUpperCase();
		}
		return name.slice(0, 2).toUpperCase();
	}
	return (email || "?")[0].toUpperCase();
}

function relativeTime(dateStr?: string | null) {
	if (!dateStr) return "";
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h`;
	const days = Math.floor(hrs / 24);
	if (days < 7) return `${days}d`;
	return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ThreadList({
	threads,
	selectedId,
	onSelectThread,
	search,
	onSearchChange,
	filter,
	onFilterChange,
	loading,
	className,
}: ThreadListProps) {
	const filtered = threads.filter((t) => {
		if (filter === "unread" && t.unread_count === 0) return false;
		return true;
	});

	return (
		<div className={cn("flex flex-col h-full border-r border-border bg-background", className)}>
			{/* Search & Filter Header */}
			<div className="p-3 border-b border-border space-y-2.5 shrink-0 bg-background/95">
				{/* Search Bar */}
				<div className="relative">
					<Search
						size={13}
						className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
					/>
					<input
						id="thread-search-input"
						type="text"
						value={search}
						onChange={(e) => onSearchChange(e.target.value)}
						placeholder="Search threads... (/)"
						className="w-full h-8 pl-7 pr-3 rounded-lg bg-muted/50 border border-border/70 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-orange-500 focus:bg-background transition-colors"
					/>
				</div>

				{/* Filter Tabs */}
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => onFilterChange("all")}
						className={cn(
							"px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
							filter === "all"
								? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
								: "text-muted-foreground hover:text-foreground hover:bg-muted/60",
						)}
					>
						All
					</button>
					<button
						type="button"
						onClick={() => onFilterChange("unread")}
						className={cn(
							"px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer",
							filter === "unread"
								? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
								: "text-muted-foreground hover:text-foreground hover:bg-muted/60",
						)}
					>
						<span>Unread</span>
						{threads.some((t) => t.unread_count > 0) && (
							<span className="size-1.5 rounded-full bg-orange-500" />
						)}
					</button>
				</div>
			</div>

			{/* Conversation Cards List */}
			<div className="flex-1 overflow-y-auto divide-y divide-border/60">
				{loading ? (
					<div className="flex items-center justify-center h-48">
						<Loader2 size={18} className="animate-spin text-muted-foreground" />
					</div>
				) : filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-64 px-4 text-center">
						<Mail size={32} strokeWidth={1.5} className="text-muted-foreground/40 mb-2" />
						<p className="text-xs font-medium text-foreground">No threads found</p>
						<p className="text-[11px] text-muted-foreground mt-0.5">
							{search
								? "Try adjusting your search query"
								: filter === "unread"
									? "You have read all messages"
									: "Incoming email threads will appear here"}
						</p>
					</div>
				) : (
					filtered.map((thread) => {
						const selected = thread.id === selectedId;
						const hasUnread = thread.unread_count > 0;
						const subject = thread.subject || "(No subject)";
						const snippet = (thread.latest_snippet || "").replace(/\s+/g, " ").trim();
						const inboxAddr = thread.inbox_address;
						const senderLabel = thread.counterparty_name || thread.counterparty_email;

						return (
							<button
								key={thread.id}
								type="button"
								onClick={() => onSelectThread(thread.id)}
								className={cn(
									"w-full text-left p-3.5 flex items-start gap-3 transition-colors relative group cursor-pointer",
									selected
										? "bg-orange-50/70 dark:bg-orange-950/20"
										: hasUnread
											? "bg-card hover:bg-muted/50"
											: "hover:bg-muted/30",
								)}
							>
								{/* Active indicator bar */}
								{selected && (
									<span className="absolute left-0 top-0 bottom-0 w-[3px] bg-orange-500 rounded-r" />
								)}

								{/* Avatar */}
								<div
									className={cn(
										"size-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold",
										hasUnread
											? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
											: "bg-muted text-muted-foreground",
									)}
								>
									{initials(thread.counterparty_name, thread.counterparty_email)}
								</div>

								{/* Thread Summary Info */}
								<div className="flex-1 min-w-0">
									<div className="flex items-baseline justify-between gap-1.5 mb-0.5">
										<span
											className={cn(
												"text-[13px] truncate",
												hasUnread
													? "font-bold text-foreground"
													: "font-semibold text-foreground/90",
											)}
										>
											{senderLabel}
										</span>
										<span className="text-[10.5px] text-muted-foreground shrink-0 tabular-nums">
											{relativeTime(thread.last_message_at)}
										</span>
									</div>

									{/* Subject */}
									<p
										className={cn(
											"text-xs truncate mb-1",
											hasUnread ? "font-bold text-foreground" : "font-medium text-foreground/80",
										)}
									>
										{subject}
									</p>

									{/* Snippet Preview */}
									{snippet && (
										<p className="text-[11.5px] text-muted-foreground line-clamp-1 leading-normal mb-1.5">
											{snippet}
										</p>
									)}

									{/* Badges footer */}
									<div className="flex items-center gap-1.5 flex-wrap">
										{inboxAddr && (
											<span className="text-[9.5px] font-medium px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground border border-border/50">
												{inboxAddr.split("@")[0]}@
											</span>
										)}
										{hasUnread && (
											<span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500 text-white">
												{thread.unread_count} unread
											</span>
										)}
										<span className="text-[10px] text-muted-foreground/70 ml-auto">
											{thread.total_count} msg{thread.total_count !== 1 ? "s" : ""}
										</span>
									</div>
								</div>
							</button>
						);
					})
				)}
			</div>
		</div>
	);
}
