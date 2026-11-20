"use client";

import React, { useState, useEffect } from "react";
import { Send, Sparkles, X, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import FromSelect from "./FromSelect";
import { Inbox as InboxType, getInboxTemplates, InboxTemplate } from "@/lib/api";

interface ComposeModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	inboxes: InboxType[];
	defaultTo?: string;
	defaultFrom?: string;
	onSend: (payload: {
		from: string;
		to: string;
		subject: string;
		text: string;
		attachments?: Array<{ filename: string; content: string; type: string }>;
	}) => Promise<void>;
}

export default function ComposeModal({
	open,
	onOpenChange,
	inboxes,
	defaultTo = "",
	defaultFrom,
	onSend,
}: ComposeModalProps) {
	const [from, setFrom] = useState(defaultFrom || inboxes[0]?.email || "");
	const [to, setTo] = useState(defaultTo);
	const [subject, setSubject] = useState("");
	const [body, setBody] = useState("");
	const [files, setFiles] = useState<Array<{ filename: string; content: string; type: string }>>([]);
	const [sending, setSending] = useState(false);
	const [templates, setTemplates] = useState<InboxTemplate[]>([]);

	useEffect(() => {
		if (defaultFrom) setFrom(defaultFrom);
		else if (inboxes.length > 0 && !from) setFrom(inboxes[0].email);
	}, [inboxes, from, defaultFrom]);

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
				attachments: files.length ? files : undefined,
			});
			setTo("");
			setSubject("");
			setBody("");
			setFiles([]);
			onOpenChange(false);
			toast.success("Message sent");
		} catch {
			toast.error("Couldn't send the message. Try again.");
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
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
				<DialogHeader className="px-5 py-3.5 border-b border-border bg-muted/30">
					<DialogTitle className="text-sm font-semibold">New message</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="flex flex-col gap-3 p-5">
					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-1.5">
							<Label className="text-xs text-muted-foreground">From Mailbox</Label>
							<FromSelect
								inboxes={inboxes}
								value={from}
								onValueChange={setFrom}
								className="h-8.5 w-full text-xs"
							/>
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
								<DropdownMenu>
									<DropdownMenuTrigger render={<Button type="button" variant="ghost" size="xs" />}>
										<Sparkles className="text-primary" /> Insert canned response
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="w-56">
										{templates.map((tpl) => (
											<DropdownMenuItem key={tpl.id} onClick={() => insertTemplate(tpl)}>
												<span className="truncate">{tpl.slug}</span>
											</DropdownMenuItem>
										))}
									</DropdownMenuContent>
								</DropdownMenu>
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
							rows={14}
							className="min-h-64 text-sm leading-relaxed resize-y p-3"
							required
						/>
					</div>

					<div className="flex flex-col gap-2">
						<label className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer">
							<Paperclip size={13} />
							Attach files
							<input
								type="file"
								multiple
								className="sr-only"
								onChange={async (e) => {
									const selected = Array.from(e.target.files ?? []);
									const encoded = await Promise.all(
										selected.map(
											(file) =>
												new Promise<{ filename: string; content: string; type: string }>(
													(resolve, reject) => {
														const reader = new FileReader();
														reader.onload = () => {
															const result = String(reader.result ?? "");
															resolve({
																filename: file.name,
																content: result.slice(result.indexOf(",") + 1),
																type: file.type || "application/octet-stream",
															});
														};
														reader.onerror = () => reject(reader.error);
														reader.readAsDataURL(file);
													},
												),
										),
									);
									setFiles((current) => [...current, ...encoded].slice(0, 10));
									e.target.value = "";
								}}
							/>
						</label>
						{files.length > 0 && (
							<div className="flex flex-wrap gap-1.5">
								{files.map((file) => (
									<Button
										key={file.filename}
										variant="outline"
										size="xs"
										type="button"
										onClick={() => setFiles((current) => current.filter((item) => item !== file))}
										className="font-normal"
									>
										{file.filename}
										<X />
									</Button>
								))}
							</div>
						)}
					</div>

					<DialogFooter className="pt-2 border-t border-border mt-2">
						<Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button
							type="submit"
							size="sm"
							disabled={sending || !body.trim() || !to.trim() || !from.trim()}
						>
							{sending ? <Spinner /> : <Send />}
							<span>{sending ? "Sending…" : "Send message"}</span>
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
