"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ThreadItem } from "@/lib/api";
import { avatarTone, initialsOf, messagePreview } from "@/lib/inbox/format";
import { cn } from "@/lib/utils";
import AttachmentList from "./AttachmentList";
import AuthBadge from "./AuthBadge";
import HtmlEmailViewer from "./HtmlEmailViewer";

interface MessageCardProps {
	item: ThreadItem;
	person: { name: string | null; email: string };
	defaultOpen: boolean;
}

export default function MessageCard({ item, person, defaultOpen }: MessageCardProps) {
	const [open, setOpen] = useState(defaultOpen);

	const inbound = item.direction === "inbound";
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
					{!open && <p className="truncate text-xs text-muted-foreground">{messagePreview(item, 120)}</p>}
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

					<HtmlEmailViewer html={item.body_html} text={item.body_text} />

					<AttachmentList attachments={item.attachments} />
				</div>
			)}
		</article>
	);
}
