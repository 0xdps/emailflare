"use client";

import React, { useEffect, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { getInboxTemplates, type Inbox, type InboxTemplate, type ThreadItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import FromSelect from "./FromSelect";

export interface ReplyPayload {
	from: string;
	to: string;
	subject: string;
	text: string;
	replyTarget?: ThreadItem | null;
}

interface InlineComposerProps {
	to: string;
	defaultSubject?: string;
	inboxes: Inbox[];
	defaultInbox?: string;
	replyTarget?: ThreadItem | null;
	onSend: (payload: ReplyPayload) => Promise<void>;
	onCancel?: () => void;
	className?: string;
}

export default function InlineComposer({
	to,
	defaultSubject = "",
	inboxes,
	defaultInbox,
	replyTarget,
	onSend,
	onCancel,
	className,
}: InlineComposerProps) {
	const [from, setFrom] = useState(defaultInbox || inboxes[0]?.email || "");
	const [body, setBody] = useState("");
	const [sending, setSending] = useState(false);
	const [templates, setTemplates] = useState<InboxTemplate[]>([]);

	const subject = defaultSubject
		? defaultSubject.toLowerCase().startsWith("re:")
			? defaultSubject
			: `Re: ${defaultSubject}`
		: "";

	useEffect(() => {
		if (defaultInbox) setFrom(defaultInbox);
		else if (inboxes.length > 0 && !from) setFrom(inboxes[0].email);
	}, [defaultInbox, inboxes, from]);

	useEffect(() => {
		getInboxTemplates()
			.then(setTemplates)
			.catch(() => {});
	}, []);

	const canSend = Boolean(body.trim() && to.trim() && from.trim()) && !sending;

	async function submit() {
		if (!canSend) return;
		setSending(true);
		try {
			await onSend({ from, to, subject, text: body.trim(), replyTarget });
			setBody("");
			toast.success("Reply sent");
			onCancel?.();
		} catch {
			toast.error("Couldn't send the reply. Try again.");
		} finally {
			setSending(false);
		}
	}

	function insertTemplate(tpl: InboxTemplate) {
		const plain = tpl.body_html.replace(/<[^>]*>/g, "").trim();
		setBody((prev) => (prev ? `${prev}\n\n${plain}` : plain));
	}

	return (
		<div
			className={cn("overflow-hidden rounded-xl border bg-card shadow-sm focus-within:border-ring/60", className)}
		>
			<div className="flex items-center gap-2 border-b px-3 py-2 text-xs">
				<span className="text-muted-foreground">From</span>
				<FromSelect
					inboxes={inboxes}
					value={from}
					onValueChange={setFrom}
					className="max-w-64 border-0 bg-transparent shadow-none"
				/>
				<span className="text-muted-foreground">to</span>
				<span className="min-w-0 truncate font-medium">{to}</span>
				{onCancel && (
					<Button
						variant="ghost"
						size="icon-xs"
						className="ml-auto"
						onClick={onCancel}
						aria-label="Discard reply"
					>
						<X />
					</Button>
				)}
			</div>

			<Textarea
				autoFocus
				value={body}
				onChange={(e) => setBody(e.target.value)}
				onKeyDown={(e) => {
					if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
						e.preventDefault();
						submit();
					}
					if (e.key === "Escape" && !body) onCancel?.();
				}}
				placeholder="Write your reply…"
				rows={4}
				className="min-h-24 resize-none rounded-none border-0 bg-transparent px-4 py-3 shadow-none focus-visible:ring-0"
			/>

			<div className="flex items-center gap-2 border-t px-3 py-2">
				{templates.length > 0 && (
					<DropdownMenu>
						<DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
							<Sparkles className="text-primary" /> Canned reply
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" side="top" className="w-60">
							<DropdownMenuGroup>
								<DropdownMenuLabel>Saved responses</DropdownMenuLabel>
								{templates.map((tpl) => (
									<DropdownMenuItem key={tpl.id} onClick={() => insertTemplate(tpl)}>
										<span className="truncate">{tpl.slug}</span>
									</DropdownMenuItem>
								))}
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				)}

				<KbdGroup className="ml-auto hidden text-muted-foreground sm:inline-flex">
					<Kbd>⌘</Kbd>
					<Kbd>↵</Kbd>
				</KbdGroup>
				<Button size="sm" onClick={submit} disabled={!canSend}>
					{sending ? <Spinner /> : <Send />}
					{sending ? "Sending…" : "Send"}
				</Button>
			</div>
		</div>
	);
}
