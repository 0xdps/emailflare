"use client";

import React, { useState, useRef, useEffect } from "react";
import {
	Reply,
	ShieldCheck,
	ShieldAlert,
	Clock,
	Mail,
	ArrowUpRight,
	ArrowDownLeft,
	Paperclip,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	User as UserIcon,
	FileText,
	ArrowLeft,
} from "lucide-react";
import { Thread, ThreadItem, Person, Inbox as InboxType } from "@/lib/api";
import { groupThread, ThreadGroup } from "@/lib/threading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import HtmlEmailViewer from "./HtmlEmailViewer";
import InlineComposer from "./InlineComposer";
import { cn } from "@/lib/utils";

interface ThreadReaderProps {
	person: { name: string | null; email: string; unread_count?: number };
	thread: Thread;
	inboxes: InboxType[];
	onReplySend: (payload: {
		from: string;
		to: string;
		subject: string;
		text: string;
		replyTarget?: ThreadItem | null;
	}) => Promise<void>;
	onMarkUnread?: () => void;
	onBack?: () => void;
}

function initials(name: string | null, email: string) {
	if (name)
		return name
			.split(" ")
			.map((s) => s[0])
			.join("")
			.slice(0, 2)
			.toUpperCase();
	return email[0].toUpperCase();
}

function stripQuotedReply(body: string | null | undefined): { content: string; quote: string | null } {
	if (!body) return { content: "", quote: null };

	const replyHeader = /^On\s.+?wrote:\s*$/m;
	const match = body.match(replyHeader);
	if (match && match.index !== undefined) {
		return {
			content: body.slice(0, match.index).trim(),
			quote: body.slice(match.index).trim(),
		};
	}

	const lines = body.split("\n");
	const firstQuote = lines.findIndex((l) => /^>\s/.test(l));
	if (firstQuote > 0) {
		return {
			content: lines.slice(0, firstQuote).join("\n").trim(),
			quote: lines.slice(firstQuote).join("\n").trim(),
		};
	}

	return { content: body.trim(), quote: null };
}

function SecurityBadge({ type, status }: { type: "SPF" | "DKIM" | "DMARC"; status?: string | null }) {
	if (!status) return null;
	const isPass = status.toLowerCase() === "pass";

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border",
				isPass
					? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
					: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
			)}
			title={`${type} authentication verdict: ${status}`}
		>
			{isPass ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}
			<span>
				{type}: {status.toUpperCase()}
			</span>
		</span>
	);
}

function MessageCard({
	item,
	isLatest,
	onReplyClick,
}: {
	item: ThreadItem;
	isLatest: boolean;
	onReplyClick: () => void;
}) {
	const [expandedQuote, setExpandedQuote] = useState(false);
	const isInbound = item.direction === "inbound";
	const date = new Date(item.timestamp);
	const { content, quote } = stripQuotedReply(item.body_text);

	return (
		<div
			className={cn(
				"rounded-xl border transition-all overflow-hidden",
				isInbound ? "bg-card border-border/80 shadow-xs" : "bg-muted/30 border-border/60",
			)}
		>
			{/* Message Header */}
			<div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border/50 bg-muted/15">
				<div className="flex items-center gap-2.5 min-w-0">
					<div
						className={cn(
							"size-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold",
							isInbound
								? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
								: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
						)}
					>
						{isInbound ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
					</div>

					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<span className="text-[13px] font-semibold text-foreground truncate">
								{isInbound
									? item.inbox_address
										? `Received from counterparty`
										: "Customer"
									: "Team Reply"}
							</span>
							{item.inbox_address && (
								<Badge
									variant="outline"
									className="text-[10px] h-4 px-1.5 font-normal text-muted-foreground"
								>
									via {item.inbox_address}
								</Badge>
							)}
						</div>
						<div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
							<Clock size={11} />
							<span>
								{date.toLocaleString(undefined, {
									month: "short",
									day: "numeric",
									year: "numeric",
									hour: "numeric",
									minute: "2-digit",
								})}
							</span>
						</div>
					</div>
				</div>

				{/* Security Badges & Reply button */}
				<div className="flex items-center gap-1.5 shrink-0">
					{isInbound && (
						<>
							<SecurityBadge type="SPF" status={item.spf} />
							<SecurityBadge type="DKIM" status={item.dkim} />
							<SecurityBadge type="DMARC" status={item.dmarc} />
						</>
					)}
					<Button
						variant="ghost"
						size="sm"
						onClick={onReplyClick}
						className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
					>
						<Reply size={12} className="mr-1" />
						Reply
					</Button>
				</div>
			</div>

			{/* Message Content */}
			<div className="p-4">
				{item.body_html ? (
					<HtmlEmailViewer html={item.body_html} text={item.body_text} />
				) : (
					<div className="text-[13.5px] leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap font-sans">
						{content || <span className="text-muted-foreground italic">No message content</span>}
					</div>
				)}

				{/* Quoted History Toggle */}
				{quote && (
					<div className="mt-3 pt-2 border-t border-border/40">
						<button
							type="button"
							onClick={() => setExpandedQuote((v) => !v)}
							className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
						>
							{expandedQuote ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
							<span>{expandedQuote ? "Hide quoted text" : "Show quoted text"}</span>
						</button>
						{expandedQuote && (
							<pre className="mt-2 text-xs text-muted-foreground/80 font-mono whitespace-pre-wrap bg-muted/20 p-2.5 rounded border border-border/40">
								{quote}
							</pre>
						)}
					</div>
				)}

				{/* Attachments List */}
				{item.attachments && item.attachments.length > 0 && (
					<div className="mt-4 pt-3 border-t border-border/50">
						<div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
							<Paperclip size={12} />
							<span>Attachments ({item.attachments.length})</span>
						</div>
						<div className="flex flex-wrap gap-2">
							{item.attachments.map((att) => (
								<div
									key={att.id}
									className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/30 text-xs text-foreground"
								>
									<FileText size={13} className="text-orange-500" />
									<span className="font-medium truncate max-w-[180px]">{att.filename}</span>
									<span className="text-[10px] text-muted-foreground">
										({Math.round(att.size / 1024)} KB)
									</span>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default function ThreadReader({
	person,
	thread,
	inboxes,
	onReplySend,
	onMarkUnread,
	onBack,
}: ThreadReaderProps) {
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const groups = groupThread(thread.thread);
	const latestItem = thread.thread[0] || null;
	const mainSubject = latestItem?.subject || "(No subject)";

	// Find default inbox address from latest inbound message
	const defaultInbox =
		thread.thread.find((it) => it.direction === "inbound")?.inbox_address || inboxes[0]?.email || "";

	return (
		<div className="flex flex-col h-full bg-background overflow-hidden">
			{/* Top Conversation Header */}
			<div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-border bg-background shrink-0 flex items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					{onBack && (
						<button
							type="button"
							onClick={onBack}
							className="md:hidden inline-flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 font-medium mb-2 hover:underline"
						>
							<ArrowLeft size={13} />
							<span>Back to conversations</span>
						</button>
					)}
					<div className="flex items-center gap-2 mb-1.5 flex-wrap">
						<h1 className="text-[17px] font-bold text-foreground tracking-tight line-clamp-1">
							{mainSubject}
						</h1>
						{(person.unread_count ?? 0) > 0 && (
							<Badge className="text-[10px] h-4.5 px-2 bg-orange-500 text-white font-semibold">New</Badge>
						)}
					</div>

					<div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
						<div className="flex items-center gap-1.5 font-medium text-foreground">
							<UserIcon size={12} className="text-orange-500" />
							<span>{person.name ? `${person.name} (${person.email})` : person.email}</span>
						</div>
						<span>·</span>
						<span>{thread.thread.length} messages</span>
						{defaultInbox && (
							<>
								<span>·</span>
								<span>
									Mailbox: <strong className="text-foreground">{defaultInbox}</strong>
								</span>
							</>
						)}
					</div>
				</div>

				<div className="flex items-center gap-2 shrink-0">
					{onMarkUnread && (
						<Button variant="outline" size="sm" onClick={onMarkUnread} className="h-8 text-xs">
							Mark unread
						</Button>
					)}
				</div>
			</div>

			{/* Conversation Messages Timeline */}
			<div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
				{/* Flattened items chronological */}
				{[...thread.thread]
					.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
					.map((item, idx, arr) => (
						<MessageCard
							key={item.id}
							item={item}
							isLatest={idx === arr.length - 1}
							onReplyClick={() => {
								messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
							}}
						/>
					))}
				<div ref={messagesEndRef} />
			</div>

			{/* Docked Inline Composer at Bottom */}
			<div className="p-4 border-t border-border bg-muted/20 shrink-0">
				<InlineComposer
					to={person.email}
					defaultSubject={mainSubject}
					inboxes={inboxes}
					defaultInbox={defaultInbox}
					replyTarget={latestItem}
					onSend={onReplySend}
				/>
			</div>
		</div>
	);
}
