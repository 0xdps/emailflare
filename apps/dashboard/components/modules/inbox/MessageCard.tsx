"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, FileText, Paperclip } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ThreadItem } from "@/lib/api";
import { avatarTone, formatBytes, initialsOf, previewText } from "@/lib/inbox/format";
import { cn } from "@/lib/utils";
import AuthBadge from "./AuthBadge";
import HtmlEmailViewer from "./HtmlEmailViewer";

export function stripQuotedReply(body: string | null | undefined): { content: string; quote: string | null } {
	if (!body) return { content: "", quote: null };

	const match = body.match(/^On\s.+?wrote:\s*$/m);
	if (match && match.index !== undefined) {
		return { content: body.slice(0, match.index).trim(), quote: body.slice(match.index).trim() };
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

interface MessageCardProps {
	item: ThreadItem;
	person: { name: string | null; email: string };
	defaultOpen: boolean;
}

export default function MessageCard({ item, person, defaultOpen }: MessageCardProps) {
	const [open, setOpen] = useState(defaultOpen);
	const [showQuote, setShowQuote] = useState(false);

	const inbound = item.direction === "inbound";
	const { content, quote } = stripQuotedReply(item.body_text);
	const name = inbound ? person.name || person.email : "You";
	const address = inbound ? person.email : item.inbox_address;
	const when = new Date(item.timestamp);

	return (
		<article className="rounded-xl border bg-card shadow-xs">
			<Button
				type="button"
				variant="ghost"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
				className="h-auto w-full justify-start gap-3 rounded-xl px-4 py-3 text-left font-normal whitespace-normal hover:bg-accent/40"
			>
				<Avatar>
					<AvatarFallback
						className={cn(
							"text-xs font-semibold",
							inbound ? avatarTone(person.email) : "bg-primary-muted text-primary-muted-foreground",
						)}
					>
						{inbound ? initialsOf(person.name, person.email) : "ME"}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<div className="flex items-baseline gap-2">
						<span className="truncate text-sm font-semibold">{name}</span>
						{address && (
							<span className="hidden truncate text-xs text-muted-foreground sm:inline">{address}</span>
						)}
					</div>
					{!open && (
						<p className="truncate text-xs text-muted-foreground">{previewText(item.body_text, 120)}</p>
					)}
					{open && inbound && item.inbox_address && (
						<p className="truncate text-xs text-muted-foreground">to {item.inbox_address}</p>
					)}
				</div>
				<time dateTime={item.timestamp} className="shrink-0 text-2xs text-muted-foreground tabular-nums">
					{when.toLocaleString(undefined, {
						month: "short",
						day: "numeric",
						hour: "numeric",
						minute: "2-digit",
					})}
				</time>
				{open ? (
					<ChevronDown className="size-4 text-muted-foreground" />
				) : (
					<ChevronRight className="size-4 text-muted-foreground" />
				)}
			</Button>

			{open && (
				<div className="space-y-3 px-4 pb-4">
					{inbound && (
						<div>
							<AuthBadge item={item} />
						</div>
					)}

					{item.body_html ? (
						<HtmlEmailViewer html={item.body_html} text={item.body_text} />
					) : (
						<div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
							{content || <span className="text-muted-foreground italic">No message content</span>}
						</div>
					)}

					{!item.body_html && quote && (
						<div>
							<Button
								type="button"
								variant="ghost"
								size="xs"
								onClick={() => setShowQuote((v) => !v)}
								className="-ml-2 text-muted-foreground"
							>
								{showQuote ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
								{showQuote ? "Hide quoted text" : "Show quoted text"}
							</Button>
							{showQuote && (
								<pre className="mt-2 rounded-md border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
									{quote}
								</pre>
							)}
						</div>
					)}

					{item.attachments && item.attachments.length > 0 && (
						<div className="border-t pt-3">
							<p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
								<Paperclip className="size-3.5" />
								{item.attachments.length} {item.attachments.length === 1 ? "attachment" : "attachments"}
							</p>
							<div className="flex flex-wrap gap-2">
								{item.attachments.map((att) => (
									<div
										key={att.id}
										className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-xs"
									>
										<FileText className="size-4 text-primary" />
										<span className="max-w-48 truncate font-medium">{att.filename}</span>
										<span className="text-muted-foreground">{formatBytes(att.size)}</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</article>
	);
}
