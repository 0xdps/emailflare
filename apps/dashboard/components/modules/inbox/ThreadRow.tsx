"use client";

import React from "react";
import { Archive, ArchiveRestore, Mail, MailOpen, Star } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { ThreadSummary } from "@/lib/api";
import { avatarTone, initialsOf, previewText, relativeTime, senderName } from "@/lib/inbox/format";
import { cn } from "@/lib/utils";

export interface ThreadActions {
	onToggleStar: (thread: ThreadSummary) => void;
	onToggleArchive: (thread: ThreadSummary) => void;
	onToggleRead: (thread: ThreadSummary) => void;
}

interface ThreadRowProps extends ThreadActions {
	thread: ThreadSummary;
	selected: boolean;
	showMailbox: boolean;
	onSelect: (id: string) => void;
}

function ThreadRow({
	thread,
	selected,
	showMailbox,
	onSelect,
	onToggleStar,
	onToggleArchive,
	onToggleRead,
}: ThreadRowProps) {
	const unread = thread.unread_count > 0;
	const name = senderName(thread.counterparty_name, thread.counterparty_email);

	return (
		<ContextMenu>
			<ContextMenuTrigger
				render={
					<div
						role="option"
						aria-selected={selected}
						tabIndex={0}
						data-thread-id={thread.id}
						data-unread={unread || undefined}
						onClick={() => onSelect(thread.id)}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								onSelect(thread.id);
							}
						}}
						className={cn(
							"group/row relative flex cursor-pointer gap-3 border-b px-4 py-3 outline-none transition-colors",
							"hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
							selected && "bg-primary/10 hover:bg-primary/10",
						)}
					/>
				}
			>
				<span
					aria-hidden
					className={cn(
						"absolute inset-y-0 left-0 w-0.5 bg-primary transition-opacity",
						unread || selected ? "opacity-100" : "opacity-0",
					)}
				/>

				<Avatar className="mt-0.5">
					<AvatarFallback className={cn("text-xs font-semibold", avatarTone(thread.counterparty_email))}>
						{initialsOf(thread.counterparty_name, thread.counterparty_email)}
					</AvatarFallback>
				</Avatar>

				<div className="min-w-0 flex-1">
					<div className="flex items-baseline gap-2">
						<span
							className={cn(
								"truncate text-sm",
								unread ? "font-semibold text-foreground" : "font-medium text-foreground/90",
							)}
						>
							{name}
						</span>
						{thread.total_count > 1 && (
							<span className="shrink-0 text-2xs text-muted-foreground tabular-nums">
								{thread.total_count}
							</span>
						)}
						<time
							dateTime={thread.last_message_at}
							className={cn(
								"ml-auto shrink-0 text-2xs tabular-nums",
								unread ? "font-medium text-primary" : "text-muted-foreground",
							)}
						>
							{relativeTime(thread.last_message_at)}
						</time>
					</div>

					<p
						className={cn(
							"truncate text-sm",
							unread ? "font-medium text-foreground" : "text-foreground/80",
						)}
					>
						{thread.subject}
					</p>

					<div className="mt-0.5 flex items-center gap-2">
						<p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
							{previewText(thread.latest_snippet) || "No preview"}
						</p>
						{showMailbox && (
							<span className="max-w-28 shrink-0 truncate rounded-sm bg-muted px-1.5 text-2xs text-muted-foreground">
								{thread.inbox_address.split("@")[0]}
							</span>
						)}
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label={thread.is_starred ? "Remove star" : "Star thread"}
							aria-pressed={thread.is_starred}
							onClick={(e) => {
								e.stopPropagation();
								onToggleStar(thread);
							}}
							className={cn(
								"-my-1 -mr-1.5 shrink-0",
								thread.is_starred
									? "text-warning"
									: "text-muted-foreground opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100",
							)}
						>
							<Star className={cn(thread.is_starred && "fill-current")} />
						</Button>
					</div>
				</div>
			</ContextMenuTrigger>

			<ContextMenuContent className="w-48">
				<ContextMenuItem onClick={() => onToggleRead(thread)}>
					{unread ? <MailOpen /> : <Mail />}
					{unread ? "Mark as read" : "Mark as unread"}
				</ContextMenuItem>
				<ContextMenuItem onClick={() => onToggleStar(thread)}>
					<Star />
					{thread.is_starred ? "Remove star" : "Star"}
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem onClick={() => onToggleArchive(thread)}>
					{thread.is_archived ? <ArchiveRestore /> : <Archive />}
					{thread.is_archived ? "Move to inbox" : "Archive"}
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}

export default React.memo(ThreadRow);
