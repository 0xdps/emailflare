"use client";

import React, { useState, useEffect } from "react";
import { Send, Loader2, Sparkles, X, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Inbox as InboxType, getInboxTemplates, InboxTemplate } from "@/lib/api";

interface ComposeModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	inboxes: InboxType[];
	defaultTo?: string;
	onSend: (payload: { from: string; to: string; subject: string; text: string }) => Promise<void>;
}

export default function ComposeModal({ open, onOpenChange, inboxes, defaultTo = "", onSend }: ComposeModalProps) {
	const [from, setFrom] = useState(inboxes[0]?.email || "");
	const [to, setTo] = useState(defaultTo);
	const [subject, setSubject] = useState("");
	const [body, setBody] = useState("");
	const [sending, setSending] = useState(false);
	const [templates, setTemplates] = useState<InboxTemplate[]>([]);
	const [showTemplates, setShowTemplates] = useState(false);

	useEffect(() => {
		if (inboxes.length > 0 && !from) {
			setFrom(inboxes[0].email);
		}
	}, [inboxes, from]);

	useEffect(() => {
		if (defaultTo) setTo(defaultTo);
	}, [defaultTo]);

	useEffect(() => {
		if (open) {
			getInboxTemplates()
				.then(setTemplates)
				.catch(() => {});
		}
	}, [open]);

	async function handleSubmit(e?: React.FormEvent) {
		if (e) e.preventDefault();
		if (!body.trim() || !to.trim() || !from.trim() || sending) return;

		setSending(true);
		try {
			await onSend({
				from: from.trim(),
				to: to.trim(),
				subject: subject.trim(),
				text: body.trim(),
			});
			setTo("");
			setSubject("");
			setBody("");
			onOpenChange(false);
		} finally {
			setSending(false);
		}
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			e.preventDefault();
			handleSubmit();
		}
	}

	function insertTemplate(tpl: InboxTemplate) {
		const plain = tpl.body_html.replace(/<[^>]*>/g, "").trim();
		setBody((prev) => (prev ? `${prev}\n\n${plain}` : plain));
		if (!subject && tpl.subject) setSubject(tpl.subject);
		setShowTemplates(false);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl p-0 overflow-hidden">
				<DialogHeader className="px-5 py-3.5 border-b border-border bg-muted/20">
					<DialogTitle className="text-sm font-semibold">New Message</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="flex flex-col gap-3 p-5">
					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-1.5">
							<Label className="text-xs text-muted-foreground">From Mailbox</Label>
							<select
								value={from}
								onChange={(e) => setFrom(e.target.value)}
								className="h-8.5 px-2.5 rounded-lg border border-border bg-background text-xs font-medium focus:outline-hidden focus:border-orange-500"
							>
								{inboxes.map((ib) => (
									<option key={ib.id} value={ib.email}>
										{ib.display_name ? `${ib.display_name} (${ib.email})` : ib.email}
									</option>
								))}
							</select>
						</div>

						<div className="flex flex-col gap-1.5">
							<Label className="text-xs text-muted-foreground">To Recipient</Label>
							<Input
								type="email"
								placeholder="client@example.com"
								value={to}
								onChange={(e) => setTo(e.target.value)}
								className="h-8.5 text-xs"
								required
							/>
						</div>
					</div>

					<div className="flex flex-col gap-1.5">
						<div className="flex items-center justify-between">
							<Label className="text-xs text-muted-foreground">Subject</Label>
							{templates.length > 0 && (
								<div className="relative">
									<button
										type="button"
										onClick={() => setShowTemplates((v) => !v)}
										className="inline-flex items-center gap-1 text-[11px] text-orange-600 hover:text-orange-700 font-medium"
									>
										<Sparkles size={11} />
										<span>Insert canned response</span>
										<ChevronDown size={10} />
									</button>
									{showTemplates && (
										<div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-border bg-popover shadow-md py-1 z-30 text-xs">
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
						<Input
							placeholder="Subject line"
							value={subject}
							onChange={(e) => setSubject(e.target.value)}
							className="h-8.5 text-xs"
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<Label className="text-xs text-muted-foreground">Message</Label>
						<Textarea
							placeholder="Write your email here... (Cmd + Enter to send)"
							value={body}
							onChange={(e) => setBody(e.target.value)}
							onKeyDown={handleKeyDown}
							rows={8}
							className="text-xs leading-relaxed resize-none p-3"
							required
						/>
					</div>

					<DialogFooter className="pt-2 border-t border-border mt-2">
						<Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button
							type="submit"
							size="sm"
							disabled={sending || !body.trim() || !to.trim() || !from.trim()}
							className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
						>
							{sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
							<span>{sending ? "Sending…" : "Send message"}</span>
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
