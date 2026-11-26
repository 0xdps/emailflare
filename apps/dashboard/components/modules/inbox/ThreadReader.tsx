"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArchiveRestore, ArrowLeft, Copy, CornerUpLeft, Mail, MoreHorizontal, Star } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Inbox, Thread, ThreadSummary } from "@/lib/api";
import InlineComposer, { type ReplyPayload } from "./InlineComposer";
import MessageCard from "./MessageCard";

interface ThreadReaderProps {
	summary: ThreadSummary;
	thread: Thread;
	inboxes: Inbox[];
	onReplySend: (payload: ReplyPayload) => Promise<void>;
	onToggleStar: () => void;
	onToggleArchive: () => void;
	onMarkUnread: () => void;
	onBack?: () => void;
	/** Increment to open the reply composer (keyboard shortcut). */
	replySignal: number;
}

function ActionButton({
	label,
	shortcut,
	children,
	...props
}: React.ComponentProps<typeof Button> & { label: string; shortcut?: string }) {
	return (
		<Tooltip>
			<TooltipTrigger render={<Button variant="ghost" size="icon" aria-label={label} {...props} />}>
				{children}
			</TooltipTrigger>
			<TooltipContent>
				{label} {shortcut && <Kbd className="ml-1">{shortcut}</Kbd>}
			</TooltipContent>
		</Tooltip>
	);
}

export default function ThreadReader({
	summary,
	thread,
	inboxes,
	onReplySend,
	onToggleStar,
	onToggleArchive,
	onMarkUnread,
	onBack,
	replySignal,
}: ThreadReaderProps) {
	const [replying, setReplying] = useState(false);
	const scroller = useRef<HTMLDivElement>(null);
	const lastSignal = useRef(replySignal);

	const person = useMemo(
		() => ({ name: summary.counterparty_name, email: summary.counterparty_email }),
		[summary.counterparty_name, summary.counterparty_email],
	);
	const messages = useMemo(
		() => [...thread.thread].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
		[thread.thread],
	);
	const latest = messages[messages.length - 1] ?? null;
	const subject = latest?.subject || summary.subject || "(No subject)";
	const defaultInbox =
		thread.thread.find((it) => it.direction === "inbound")?.inbox_address || inboxes[0]?.email || "";

	useEffect(() => {
		if (replySignal !== lastSignal.current) {
			lastSignal.current = replySignal;
			setReplying(true);
		}
	}, [replySignal]);

	useEffect(() => setReplying(false), [summary.id]);

	// Open at the start of the newest message. Scrolling to the very bottom would land mid-message
	// once HTML bodies finish sizing.
	useEffect(() => {
		const frame = requestAnimationFrame(() => {
			const box = scroller.current;
			const cards = box?.querySelectorAll("article");
			const latest = cards?.[cards.length - 1];
			if (!box || !latest) return;
			const offset = latest.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
			box.scrollTo({ top: Math.max(0, offset - 12) });
		});
		return () => cancelAnimationFrame(frame);
	}, [summary.id, messages.length]);

	return (
		<div className="flex h-full min-h-0 flex-col bg-background">
			<header className="shrink-0 border-b bg-card px-4 py-3 sm:px-6">
				<div className="flex items-start gap-2">
					{onBack && (
						<Button
							variant="ghost"
							size="icon"
							className="-ml-2 md:hidden"
							onClick={onBack}
							aria-label="Back to inbox"
						>
							<ArrowLeft />
						</Button>
					)}
					<div className="min-w-0 flex-1">
						<h2 className="text-lg leading-snug font-semibold tracking-tight break-words">{subject}</h2>
						<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
							<span className="font-medium text-foreground">{person.name || person.email}</span>
							{person.name && <span>{person.email}</span>}
							<span aria-hidden>·</span>
							<span>
								{messages.length} {messages.length === 1 ? "message" : "messages"}
							</span>
							{defaultInbox && (
								<Badge variant="secondary" className="font-normal">
									<Mail /> {defaultInbox}
								</Badge>
							)}
						</div>
					</div>

					<div className="flex shrink-0 items-center">
						<ActionButton
							label={summary.is_starred ? "Remove star" : "Star"}
							shortcut="S"
							onClick={onToggleStar}
							aria-pressed={summary.is_starred}
						>
							<Star className={summary.is_starred ? "fill-warning text-warning" : undefined} />
						</ActionButton>
						<ActionButton
							label={summary.is_archived ? "Move to inbox" : "Archive"}
							shortcut="E"
							onClick={onToggleArchive}
						>
							{summary.is_archived ? <ArchiveRestore /> : <Archive />}
						</ActionButton>
						<DropdownMenu>
							<DropdownMenuTrigger
								render={<Button variant="ghost" size="icon" aria-label="More actions" />}
							>
								<MoreHorizontal />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-52">
								<DropdownMenuItem onClick={onMarkUnread}>
									<Mail /> Mark as unread
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => {
										navigator.clipboard?.writeText(person.email);
										toast.success("Email address copied");
									}}
								>
									<Copy /> Copy sender address
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => setReplying(true)}>
									<CornerUpLeft /> Reply
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</header>

			<div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-5 sm:px-6">
					{messages.map((item, index) => (
						<MessageCard
							key={item.id}
							item={item}
							person={person}
							defaultOpen={index === messages.length - 1}
						/>
					))}
				</div>
			</div>

			<div className="shrink-0 border-t bg-card/60 px-4 py-3 sm:px-6">
				<div className="mx-auto max-w-3xl">
					{replying ? (
						<InlineComposer
							to={person.email}
							defaultSubject={subject}
							inboxes={inboxes}
							defaultInbox={defaultInbox}
							replyTarget={latest}
							onSend={onReplySend}
							onCancel={() => setReplying(false)}
						/>
					) : (
						<Button
							type="button"
							variant="outline"
							onClick={() => setReplying(true)}
							className="h-11 w-full justify-start gap-2 rounded-xl bg-background px-4 font-normal text-muted-foreground shadow-xs hover:text-foreground"
						>
							<CornerUpLeft className="size-4" />
							<span className="flex-1 text-left">Reply to {person.name || person.email}…</span>
							<Kbd>R</Kbd>
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
