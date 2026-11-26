"use client";

import React, { useEffect, useRef, useState } from "react";
import { Search, MailOpen, ChevronDown, Reply, PenLine } from "lucide-react";
import {
	getPeople,
	getThread,
	replyTo,
	composeSend,
	getInboxes,
	Person,
	Thread,
	ThreadItem,
	Inbox as InboxType,
} from "@/lib/api";
import { markReadAction } from "@/app/actions/inbox";
import { cn } from "@/lib/utils";
import { groupThread, replyReferences, ThreadGroup } from "@/lib/threading";
import { useNotifications } from "@/hooks/useNotifications";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { avatarTone, initialsOf, messagePreview } from "@/lib/inbox/format";
import AttachmentList from "@/components/modules/inbox/AttachmentList";
import HtmlEmailViewer from "@/components/modules/inbox/HtmlEmailViewer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import OwnerAccessBanner from "@/components/OwnerAccessBanner";

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string) {
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

// ── Contact row ───────────────────────────────────────────────────────────────

function ContactRow({ person, selected, onClick }: { person: Person; selected: boolean; onClick: () => void }) {
	const hasUnread = person.unread_count > 0;
	return (
		<Button
			variant="ghost"
			onClick={onClick}
			aria-pressed={selected}
			className={cn(
				"relative h-auto w-full items-start justify-start gap-3 rounded-none border-0 border-b border-border px-4 py-3 text-left font-normal whitespace-normal",
				selected && "bg-muted hover:bg-muted",
			)}
		>
			{selected && <span aria-hidden className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-primary" />}

			<Avatar className="mt-0.5">
				<AvatarFallback className={cn("text-xs font-semibold", avatarTone(person.email))}>
					{initialsOf(person.name, person.email)}
				</AvatarFallback>
			</Avatar>

			<span className="block min-w-0 flex-1">
				<span className="flex items-baseline justify-between gap-2">
					<span
						className={cn(
							"truncate text-sm",
							hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground/90",
						)}
					>
						{person.name ?? person.email}
					</span>
					<span className="shrink-0 text-2xs text-muted-foreground tabular-nums">
						{person.last_email_at ? relativeTime(person.last_email_at) : ""}
					</span>
				</span>
				{person.name && (
					<span className="mt-0.5 block truncate text-xs text-muted-foreground">{person.email}</span>
				)}
				<span className="mt-1 flex items-center gap-2">
					<span className="text-2xs text-muted-foreground">
						{person.total_count} msg{person.total_count !== 1 ? "s" : ""}
					</span>
					{hasUnread && (
						<Badge className="h-4 min-w-4 px-1 text-2xs tabular-nums">{person.unread_count}</Badge>
					)}
				</span>
			</span>
		</Button>
	);
}

// ── Email card ────────────────────────────────────────────────────────────────

function EmailCard({
	item,
	defaultOpen = false,
	onReply,
}: {
	item: ThreadItem;
	defaultOpen?: boolean;
	onReply?: (item: ThreadItem) => void;
}) {
	const [open, setOpen] = useState(defaultOpen);
	const isSent = item.direction === "outbound";
	const date = new Date(item.timestamp);
	const subject = item.subject;
	const preview = messagePreview(item, 120);

	return (
		<div
			className={cn(
				"overflow-hidden rounded-lg border transition-shadow",
				open ? "border-border shadow-sm" : "hover:border-border",
			)}
		>
			<div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
				<Button
					variant="ghost"
					className="h-auto min-w-0 flex-1 items-start justify-start gap-3 rounded-none p-0 text-left font-normal whitespace-normal hover:bg-transparent dark:hover:bg-transparent"
					onClick={() => setOpen((v) => !v)}
					aria-expanded={open}
				>
					<Avatar size="sm" className="mt-0.5">
						<AvatarFallback
							className={cn(
								"text-2xs font-semibold",
								isSent
									? "bg-primary-muted text-primary-muted-foreground"
									: "bg-muted text-muted-foreground",
							)}
						>
							{isSent ? "Me" : (subject?.[0]?.toUpperCase() ?? "?")}
						</AvatarFallback>
					</Avatar>

					<span className="block min-w-0 flex-1">
						<span className="flex items-baseline justify-between gap-3">
							<span className="truncate text-xs font-semibold text-foreground">
								{isSent ? "You" : subject || "(no subject)"}
							</span>
							<span className="shrink-0 text-2xs text-muted-foreground tabular-nums">
								{date.toLocaleString(undefined, {
									month: "short",
									day: "numeric",
									hour: "numeric",
									minute: "2-digit",
								})}
							</span>
						</span>
						{!open && preview && (
							<span className="mt-0.5 block truncate text-xs text-muted-foreground">{preview}</span>
						)}
						{isSent && (
							<Badge variant="soft" className="mt-1 h-4 rounded-sm text-2xs">
								Sent
							</Badge>
						)}
					</span>

					<ChevronDown
						className={cn(
							"mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform",
							open && "rotate-180",
						)}
					/>
				</Button>

				{onReply && (
					<Button
						variant="ghost"
						size="xs"
						onClick={() => onReply(item)}
						className="shrink-0 text-muted-foreground hover:text-primary"
						title={`Reply to ${isSent ? "this message" : (subject ?? "message")}`}
					>
						<Reply />
						Reply
					</Button>
				)}
			</div>

			{open && (
				<div className="space-y-3 border-t border-border px-4 pt-3 pb-4">
					<HtmlEmailViewer html={item.body_html} text={item.body_text} />
					<AttachmentList attachments={item.attachments} />
				</div>
			)}
		</div>
	);
}

// ── Thread panel ──────────────────────────────────────────────────────────────

function ThreadPanel({
	person,
	thread,
	onReply,
}: {
	person: Person;
	thread: Thread;
	onReply: (item: ThreadItem) => void;
}) {
	const bottomRef = useRef<HTMLDivElement>(null);
	const groups = groupThread(thread.thread);

	// Group threads by inbox address
	const inboxGroups = new Map<string, ThreadGroup[]>();
	for (const g of groups) {
		const addr = g.items[0]?.inbox_address ?? "unknown";
		if (!inboxGroups.has(addr)) inboxGroups.set(addr, []);
		inboxGroups.get(addr)!.push(g);
	}

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [thread.thread.length]);

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
				<Avatar>
					<AvatarFallback className={cn("text-xs font-semibold", avatarTone(person.email))}>
						{initialsOf(person.name, person.email)}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1 leading-none">
					<p className="text-sm font-semibold text-foreground">{person.name ?? person.email}</p>
					{person.name && <p className="mt-1 text-xs text-muted-foreground">{person.email}</p>}
				</div>
				<span className="shrink-0 text-xs text-muted-foreground">
					{groups.length} conversation{groups.length !== 1 ? "s" : ""}
				</span>
			</div>

			{/* Threads grouped by inbox */}
			<div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
				{Array.from(inboxGroups.entries()).map(([inboxAddr, inboxThreads]) => (
					<div key={inboxAddr}>
						{/* Inbox header */}
						<div className="mb-3 flex items-center gap-2">
							<span className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
								{inboxAddr}
							</span>
							<span className="text-2xs text-muted-foreground/70">
								{inboxThreads.length} thread{inboxThreads.length !== 1 ? "s" : ""}
							</span>
							<Separator className="flex-1" />
						</div>
						{/* Threads within this inbox */}
						<div className="flex flex-col gap-4">
							{inboxThreads.map((group) => (
								<div key={group.key} className="flex flex-col gap-2">
									{/* Sub-thread label */}
									<div className="flex items-center gap-2">
										<span className="truncate text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
											{group.subject ?? "(no subject)"}
										</span>
										<span className="shrink-0 text-2xs text-muted-foreground/70">
											{group.items.length} msg{group.items.length !== 1 ? "s" : ""}
										</span>
										<Separator className="flex-1" />
									</div>
									{group.items.map((item: ThreadItem, i: number) => (
										<EmailCard
											key={item.id}
											item={item}
											defaultOpen={i === group.items.length - 1}
											onReply={onReply}
										/>
									))}
								</div>
							))}
						</div>
					</div>
				))}
				<div ref={bottomRef} />
			</div>
		</div>
	);
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
	return (
		<Empty className="h-full select-none">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<MailOpen />
				</EmptyMedia>
				<EmptyDescription>{message}</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function People({
	initialPeople,
	initialInboxes,
}: {
	initialPeople?: Person[];
	initialInboxes?: InboxType[];
}) {
	const [people, setPeople] = useState<Person[]>(initialPeople ?? []);
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<"all" | "unread">("all");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [thread, setThread] = useState<Thread | null>(null);
	const [loadingPeople, setLoadingPeople] = useState(initialPeople === undefined);
	const [loadingThread, setLoadingThread] = useState(false);
	const [inboxes, setInboxes] = useState<InboxType[]>(initialInboxes ?? []);

	// Compose dialog state
	const [composeOpen, setComposeOpen] = useState(false);
	const [composeTo, setComposeTo] = useState("");
	const [composeFrom, setComposeFrom] = useState("");
	const [composeSubject, setComposeSubject] = useState("");
	const [composeBody, setComposeBody] = useState("");
	const [composeSending, setComposeSending] = useState(false);
	const [replyTarget, setReplyTarget] = useState<ThreadItem | null>(null);
	const importInputRef = useRef<HTMLInputElement>(null);

	useNotifications((msg) => {
		if (msg.type === "new_email") {
			loadPeople();
			if (selectedId && msg.personId === selectedId) {
				getThread(selectedId)
					.then(setThread)
					.catch(() => {});
			}
		}
	});

	function loadPeople() {
		setLoadingPeople(true);
		getPeople({ search: search || undefined })
			.then(({ data }) => setPeople(data))
			.finally(() => setLoadingPeople(false));
	}

	useEffect(() => {
		if (initialPeople === undefined || search !== "") {
			loadPeople();
		}
	}, [search, initialPeople]);

	useEffect(() => {
		if (initialInboxes === undefined) {
			getInboxes()
				.then(setInboxes)
				.catch((err) => {
					console.error("[People] failed to fetch inboxes:", err);
				});
		}
	}, [initialInboxes]);

	async function selectPerson(id: string) {
		setSelectedId(id);
		setLoadingThread(true);
		try {
			const t = await getThread(id);
			setThread(t);
			await markReadAction(id).catch((err) => {
				console.error("[People] failed to mark thread as read:", err);
			});
			setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, unread_count: 0 } : p)));
		} finally {
			setLoadingThread(false);
		}
	}

	// Open compose dialog for a brand-new email (to anyone).
	function openCompose() {
		setReplyTarget(null);
		// Prefill with the selected contact if there is one; otherwise blank.
		setComposeTo(selected?.email ?? "");
		setComposeFrom(inboxes[0]?.email ?? "");
		setComposeSubject("");
		setComposeBody("");
		setComposeOpen(true);
	}

	// Open compose dialog pre-filled as a reply to a specific message.
	function openReply(target: ThreadItem) {
		setReplyTarget(target);
		setComposeTo(thread?.person.email ?? "");
		setComposeFrom(target.inbox_address ?? inboxes[0]?.email ?? "");
		setComposeSubject(target.direction === "inbound" ? `Re: ${target.subject ?? ""}` : (target.subject ?? ""));
		setComposeBody("");
		setComposeOpen(true);
	}

	async function handleComposeSend() {
		if (!composeBody.trim() || !composeTo.trim() || !composeFrom.trim()) return;
		setComposeSending(true);
		try {
			if (replyTarget && selectedId) {
				await replyTo({
					personId: selectedId,
					to: composeTo,
					from: composeFrom,
					subject: composeSubject,
					text: composeBody.trim(),
					replyToMessageId: replyTarget.message_id ?? "",
					references: replyReferences(replyTarget),
				});
			} else {
				const result = await composeSend({
					to: composeTo,
					from: composeFrom,
					subject: composeSubject,
					text: composeBody.trim(),
					personId: selectedId ?? undefined,
				});
				// If this was a brand-new contact, select it
				if (!selectedId && result.personId) {
					setSelectedId(result.personId);
				}
			}
			setComposeOpen(false);
			// Refresh the people list (new contact may have been created)
			loadPeople();
			// Refresh the thread
			const refreshId = selectedId;
			if (refreshId) {
				const updated = await getThread(refreshId);
				setThread(updated);
			}
		} finally {
			setComposeSending(false);
		}
	}

	const filtered = people.filter((p) => (filter === "unread" ? p.unread_count > 0 : true));
	const selected = people.find((p) => p.id === selectedId) ?? null;

	return (
		<div className="flex h-full flex-col">
			<OwnerAccessBanner />
			<div className="flex flex-1 overflow-hidden">
				{/* ── Left: contact list ── */}
				<div className="flex h-full w-68 shrink-0 flex-col border-r border-border">
					<div className="flex items-center justify-between px-3 pt-3">
						<h1 className="text-sm font-semibold tracking-tight">Contacts</h1>
						<Button
							variant="ghost"
							size="xs"
							className="text-muted-foreground"
							onClick={() => importInputRef.current?.click()}
						>
							Import CSV
						</Button>
						<Input
							ref={importInputRef}
							type="file"
							accept=".csv,text/csv"
							className="sr-only"
							tabIndex={-1}
							aria-label="Import CSV"
							onChange={async (e) => {
								const file = e.target.files?.[0];
								const inbox = inboxes[0]?.email;
								if (!file || !inbox) return;
								const { default: client } = await import("@/lib/api");
								await client.post(
									`/api/inbox/people/import?inbox=${encodeURIComponent(inbox)}`,
									await file.text(),
									{
										headers: { "Content-Type": "text/csv" },
									},
								);
								loadPeople();
								e.target.value = "";
							}}
						/>
					</div>
					{/* Compose (global) */}
					<div className="shrink-0 px-3 pt-3">
						<Button onClick={openCompose} className="w-full">
							<PenLine />
							Compose
						</Button>
					</div>

					{/* Search + filter bar */}
					<div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
						<InputGroup className="flex-1">
							<InputGroupAddon>
								<Search />
							</InputGroupAddon>
							<InputGroupInput
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Search…"
							/>
						</InputGroup>
						<ToggleGroup
							variant="outline"
							size="sm"
							spacing={0}
							value={[filter]}
							onValueChange={(v) => v[0] && setFilter(v[0] as "all" | "unread")}
							className="shrink-0"
						>
							{(["all", "unread"] as const).map((f) => (
								<ToggleGroupItem key={f} value={f} className="text-xs capitalize">
									{f}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</div>

					{/* List */}
					<div className="flex-1 overflow-y-auto">
						{loadingPeople ? (
							<div className="space-y-1 p-3">
								{[...Array(5)].map((_, i) => (
									<Skeleton key={i} className="h-14 rounded-lg" />
								))}
							</div>
						) : filtered.length === 0 ? (
							<EmptyState
								message={
									search ? "No results" : filter === "unread" ? "All caught up" : "No contacts yet"
								}
							/>
						) : (
							filtered.map((p) => (
								<ContactRow
									key={p.id}
									person={p}
									selected={p.id === selectedId}
									onClick={() => selectPerson(p.id)}
								/>
							))
						)}
					</div>
				</div>

				{/* ── Right: thread ── */}
				<div className="h-full min-w-0 flex-1 overflow-hidden">
					{loadingThread ? (
						<div className="flex h-full items-center justify-center">
							<Spinner className="size-5 text-muted-foreground" />
						</div>
					) : selected && thread ? (
						<ThreadPanel person={selected} thread={thread} onReply={openReply} />
					) : (
						<EmptyState message="Select a contact to view their thread" />
					)}
				</div>
			</div>

			{/* ── Compose / Reply dialog ── */}
			<Dialog open={composeOpen} onOpenChange={setComposeOpen}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>{replyTarget ? "Reply" : "New email"}</DialogTitle>
						{replyTarget && (
							<DialogDescription>
								Replying to{" "}
								<span className="font-medium text-foreground">
									{replyTarget.subject ?? "(no subject)"}
								</span>
							</DialogDescription>
						)}
					</DialogHeader>
					<div className="flex flex-col gap-3 py-2">
						<div className="grid grid-cols-2 gap-3">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="compose-from">From</Label>
								<Input
									id="compose-from"
									value={composeFrom}
									onChange={(e) => setComposeFrom(e.target.value)}
									list="compose-from-inboxes"
								/>
								<datalist id="compose-from-inboxes">
									{inboxes.map((ib) => (
										<option key={ib.id} value={ib.email} />
									))}
								</datalist>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="compose-to">To</Label>
								<Input
									id="compose-to"
									value={composeTo}
									onChange={(e) => setComposeTo(e.target.value)}
								/>
							</div>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="compose-subject">Subject</Label>
							<Input
								id="compose-subject"
								value={composeSubject}
								onChange={(e) => setComposeSubject(e.target.value)}
							/>
						</div>
						<Textarea
							value={composeBody}
							onChange={(e) => setComposeBody(e.target.value)}
							placeholder="Write your message…"
							rows={8}
							aria-label="Message"
							className="resize-none"
						/>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setComposeOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleComposeSend}
							disabled={composeSending || !composeBody.trim() || !composeTo.trim() || !composeFrom.trim()}
						>
							{composeSending && <Spinner />}
							{composeSending ? "Sending…" : "Send"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
