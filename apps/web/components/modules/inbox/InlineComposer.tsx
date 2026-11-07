"use client";

import React, { useState, useEffect } from "react";
import { Send, Loader2, Sparkles, X, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Inbox as InboxType, ThreadItem, getInboxTemplates, InboxTemplate } from "@/lib/api";
import { cn } from "@/lib/utils";

interface InlineComposerProps {
	to: string;
	defaultSubject?: string;
	inboxes: InboxType[];
	defaultInbox?: string;
	replyTarget?: ThreadItem | null;
	onSend: (payload: {
		from: string;
		to: string;
		subject: string;
		text: string;
		replyTarget?: ThreadItem | null;
	}) => Promise<void>;
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
	const [subject, setSubject] = useState(
		defaultSubject
			? defaultSubject.toLowerCase().startsWith("re:")
				? defaultSubject
				: `Re: ${defaultSubject}`
			: "",
	);
	const [body, setBody] = useState("");
	const [sending, setSending] = useState(false);
	const [templates, setTemplates] = useState<InboxTemplate[]>([]);
	const [showTemplates, setShowTemplates] = useState(false);

	useEffect(() => {
		if (defaultInbox) setFrom(defaultInbox);
		else if (inboxes.length > 0 && !from) setFrom(inboxes[0].email);
	}, [defaultInbox, inboxes]);

	useEffect(() => {
		getInboxTemplates()
			.then(setTemplates)
			.catch(() => {});
	}, []);

	async function handleSubmit(e?: React.FormEvent) {
		if (e) e.preventDefault();
		if (!body.trim() || !to.trim() || !from.trim() || sending) return;

		setSending(true);
		try {
			await onSend({
				from,
				to,
				subject,
				text: body.trim(),
				replyTarget,
			});
			setBody("");
		} finally {
			setSending(false);
		}
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		// Cmd + Enter (Mac) or Ctrl + Enter (Windows) to send
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			e.preventDefault();
			handleSubmit();
		}
	}

	function insertTemplate(tpl: InboxTemplate) {
		// Strip simple HTML tags if body is HTML
		const plain = tpl.body_html.replace(/<[^>]*>/g, "").trim();
		setBody((prev) => (prev ? `${prev}\n\n${plain}` : plain));
		setShowTemplates(false);
	}

	return (
		<div className={cn("border border-border/90 rounded-xl bg-card shadow-xs overflow-hidden", className)}>
			{/* Top Bar: Sender / Recipient / Template Picker */}
			<div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-b border-border/60 bg-muted/20 text-xs">
				<div className="flex items-center gap-2 flex-wrap">
					<div className="flex items-center gap-1.5">
						<span className="text-muted-foreground font-medium">From:</span>
						<select
							value={from}
							onChange={(e) => setFrom(e.target.value)}
							className="h-6 px-2 rounded border border-border/80 bg-background text-xs font-medium focus:outline-hidden focus:border-orange-500"
						>
							{inboxes.map((ib) => (
								<option key={ib.id} value={ib.email}>
									{ib.display_name ? `${ib.display_name} <${ib.email}>` : ib.email}
								</option>
							))}
						</select>
					</div>

					<div className="flex items-center gap-1 text-muted-foreground">
						<span>→</span>
						<span className="font-semibold text-foreground">{to}</span>
					</div>
				</div>

				{/* Canned templates dropdown */}
				{templates.length > 0 && (
					<div className="relative">
						<button
							type="button"
							onClick={() => setShowTemplates((v) => !v)}
							className="inline-flex items-center gap-1 h-6 px-2 rounded border border-border/70 bg-background text-[11px] font-medium text-zinc-600 hover:text-foreground transition-colors"
						>
							<Sparkles size={11} className="text-orange-500" />
							<span>Canned reply</span>
							<ChevronDown size={10} />
						</button>

						{showTemplates && (
							<div className="absolute right-0 bottom-full mb-1 w-64 rounded-lg border border-border bg-popover shadow-md py-1 z-30 text-xs">
								<div className="px-3 py-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
									Saved Responses
								</div>
								{templates.map((tpl) => (
									<button
										key={tpl.id}
										type="button"
										onClick={() => insertTemplate(tpl)}
										className="w-full text-left px-3 py-1.5 hover:bg-muted text-xs truncate transition-colors"
									>
										{tpl.slug}
									</button>
								))}
							</div>
						)}
					</div>
				)}
			</div>

			{/* Body Input */}
			<div className="p-3">
				<Textarea
					value={body}
					onChange={(e) => setBody(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Write your reply... (Cmd + Enter to send)"
					rows={4}
					className="w-full text-[13.5px] border-0 shadow-none focus-visible:ring-0 p-1 resize-none min-h-[90px] leading-relaxed bg-transparent"
				/>
			</div>

			{/* Bottom Action Footer */}
			<div className="flex items-center justify-between px-3 py-2 border-t border-border/60 bg-muted/10">
				<span className="text-[11px] text-muted-foreground hidden sm:inline">
					Tip: Press{" "}
					<kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">⌘</kbd> +{" "}
					<kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">Enter</kbd>{" "}
					to send
				</span>

				<div className="flex items-center gap-2 ml-auto">
					{onCancel && (
						<Button size="sm" variant="ghost" onClick={onCancel} className="h-7.5 text-xs">
							Cancel
						</Button>
					)}
					<Button
						size="sm"
						onClick={() => handleSubmit()}
						disabled={sending || !body.trim() || !to.trim() || !from.trim()}
						className="h-7.5 px-3 bg-orange-600 hover:bg-orange-700 text-white text-xs gap-1.5 font-medium shadow-xs"
					>
						{sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
						<span>{sending ? "Sending…" : "Send reply"}</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
