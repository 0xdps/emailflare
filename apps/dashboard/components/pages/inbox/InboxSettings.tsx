"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Pencil, Inbox, Users, Globe, AlertTriangle, Check } from "lucide-react";
import {
	getInboxes,
	getInboxMembers,
	getDomains,
	Inbox as InboxType,
	Domain as DomainType,
	User,
	getUsers,
} from "@/lib/api";
import {
	createInboxAction,
	updateInboxAction,
	deleteInboxAction,
	retryInboxRoutingAction,
	addInboxMemberAction,
	removeInboxMemberAction,
} from "@/app/actions/inboxes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PageShell } from "@/components/app/PageHeader";

const MODE_ITEMS = [
	{ value: "thread", label: "Thread" },
	{ value: "individual", label: "Individual" },
];

function userItems(users: User[]) {
	return users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }));
}

function MemberRow({ user, onRemove, className }: { user: User; onRemove: () => void; className?: string }) {
	return (
		<div className={cn("flex items-center gap-3 rounded-lg px-3 py-2", className)}>
			<Avatar size="sm">
				<AvatarFallback>{(user.name || user.email).charAt(0).toUpperCase()}</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium text-foreground">{user.name}</p>
				<p className="truncate text-xs text-muted-foreground">{user.email}</p>
			</div>
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label={`Remove ${user.name}`}
				className="text-muted-foreground hover:text-destructive"
				onClick={onRemove}
			>
				<Trash2 />
			</Button>
		</div>
	);
}

function UserPicker({
	users,
	value,
	onValueChange,
	onAdd,
	adding,
}: {
	users: User[];
	value: string;
	onValueChange: (value: string) => void;
	onAdd: () => void;
	adding: boolean;
}) {
	const items = userItems(users);
	return (
		<div className="flex gap-2">
			<Select items={items} value={value} onValueChange={(v) => onValueChange(v ?? "")}>
				<SelectTrigger className="min-w-0 flex-1">
					<SelectValue placeholder="Select user…" />
				</SelectTrigger>
				<SelectContent>
					{items.map((o) => (
						<SelectItem key={o.value} value={o.value}>
							{o.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Button onClick={onAdd} disabled={!value || adding}>
				{adding ? <Spinner data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
				Add
			</Button>
		</div>
	);
}

function ModeSelect({ value, onValueChange }: { value: "thread" | "individual"; onValueChange: (v: string) => void }) {
	return (
		<Select items={MODE_ITEMS} value={value} onValueChange={(v) => onValueChange(v ?? "thread")}>
			<SelectTrigger className="w-full">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{MODE_ITEMS.map((o) => (
					<SelectItem key={o.value} value={o.value}>
						{o.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

// ── Main page ─────────────────────────────────────────────────────────────────

export interface InboxSettingsProps {
	initialInboxes?: InboxType[];
	initialDomains?: DomainType[];
}

export default function InboxSettings({ initialInboxes, initialDomains }: InboxSettingsProps = {}) {
	const [inboxes, setInboxes] = useState<InboxType[]>(initialInboxes ?? []);
	const [domains, setDomains] = useState<DomainType[]>(initialDomains ?? []);
	const [loading, setLoading] = useState(!initialInboxes);
	const [createOpen, setCreateOpen] = useState(false);
	const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
	const [createdInbox, setCreatedInbox] = useState<InboxType | null>(null);
	const [creating, setCreating] = useState(false);
	const [editing, setEditing] = useState<InboxType | null>(null);
	const [localPart, setLocalPart] = useState("");
	const [selectedDomain, setSelectedDomain] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [mode, setMode] = useState<"thread" | "individual">("thread");
	const [saving, setSaving] = useState(false);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [routingId, setRoutingId] = useState<string | null>(null);

	// Step 3 — user assignment
	const [assignUsers, setAssignUsers] = useState<User[]>([]);
	const [assignMembers, setAssignMembers] = useState<User[]>([]);
	const [assignUserId, setAssignUserId] = useState("");
	const [assignAdding, setAssignAdding] = useState(false);

	// Members sheet
	const [membersInbox, setMembersInbox] = useState<InboxType | null>(null);
	const [members, setMembers] = useState<User[]>([]);
	const [allUsers, setAllUsers] = useState<User[]>([]);
	const [addUserId, setAddUserId] = useState("");
	const [loadingMembers, setLoadingMembers] = useState(false);
	const [addingMember, setAddingMember] = useState(false);

	useEffect(() => {
		if (!initialInboxes) {
			Promise.all([getInboxes(), getDomains()])
				.then(([inboxList, domainList]) => {
					setInboxes(inboxList);
					setDomains(domainList);
				})
				.finally(() => setLoading(false));
		}
	}, []);

	function openCreate() {
		setLocalPart("");
		setSelectedDomain(domains[0]?.name ?? "");
		setDisplayName("");
		setMode("thread");
		setCreateStep(1);
		setCreatedInbox(null);
		setAssignUsers([]);
		setAssignMembers([]);
		setAssignUserId("");
		setCreateOpen(true);
	}

	function openEdit(inbox: InboxType) {
		setEditing(inbox);
		setDisplayName(inbox.display_name);
		setMode(inbox.mode);
	}

	// Step 1 → create the inbox (backend also attempts routing auto-config)
	async function handleCreateInbox() {
		setCreating(true);
		try {
			const created = await createInboxAction({
				email: `${localPart.trim()}@${selectedDomain}`,
				display_name: displayName,
				mode,
			});
			setCreatedInbox(created);
			setInboxes((prev) => [...prev, created]);
			setCreateStep(2);
		} finally {
			setCreating(false);
		}
	}

	// Step 2 → retry routing if it failed
	async function handleRetryRouting() {
		if (!createdInbox) return;
		setRoutingId(createdInbox.id);
		try {
			const result = await retryInboxRoutingAction(createdInbox.id);
			const updated = { ...createdInbox, routing: result.routing };
			setCreatedInbox(updated);
			setInboxes((prev) => prev.map((i) => (i.id === createdInbox.id ? updated : i)));
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Routing setup failed";
			const updated = { ...createdInbox, routing: { configured: false, error: msg } };
			setCreatedInbox(updated);
			setInboxes((prev) => prev.map((i) => (i.id === createdInbox.id ? updated : i)));
		} finally {
			setRoutingId(null);
		}
	}

	// Step 2 → advance to user assignment (load all users)
	async function goToAssign() {
		setCreateStep(3);
		setAssignUserId("");
		try {
			setAssignUsers(await getUsers());
		} catch {
			/* leave empty */
		}
	}

	async function handleAssignMember() {
		if (!createdInbox || !assignUserId) return;
		setAssignAdding(true);
		try {
			await addInboxMemberAction(createdInbox.id, assignUserId);
			const user = assignUsers.find((u) => u.id === assignUserId);
			if (user) setAssignMembers((prev) => [...prev, user]);
			setAssignUserId("");
		} finally {
			setAssignAdding(false);
		}
	}

	function finishCreate() {
		setCreateOpen(false);
		setCreatedInbox(null);
		setCreateStep(1);
	}

	async function handleEditSave() {
		if (!editing) return;
		setSaving(true);
		try {
			await updateInboxAction(editing.id, { display_name: displayName, mode });
			setInboxes((prev) =>
				prev.map((i) => (i.id === editing.id ? { ...i, display_name: displayName, mode } : i)),
			);
			setEditing(null);
		} finally {
			setSaving(false);
		}
	}

	async function handleDelete() {
		if (!deleteId) return;
		setDeleting(true);
		try {
			await deleteInboxAction(deleteId);
			setInboxes((prev) => prev.filter((i) => i.id !== deleteId));
			setDeleteId(null);
		} finally {
			setDeleting(false);
		}
	}

	async function handleSetupRouting(inbox: InboxType) {
		setRoutingId(inbox.id);
		try {
			const result = await retryInboxRoutingAction(inbox.id);
			setInboxes((prev) => prev.map((i) => (i.id === inbox.id ? { ...i, routing: result.routing } : i)));
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Routing setup failed";
			setInboxes((prev) =>
				prev.map((i) => (i.id === inbox.id ? { ...i, routing: { configured: false, error: msg } } : i)),
			);
		} finally {
			setRoutingId(null);
		}
	}

	async function openMembers(inbox: InboxType) {
		setMembersInbox(inbox);
		setAddUserId("");
		setLoadingMembers(true);
		try {
			const [m, users] = await Promise.all([getInboxMembers(inbox.id), getUsers()]);
			setMembers(m);
			setAllUsers(users);
		} finally {
			setLoadingMembers(false);
		}
	}

	async function handleAddMember() {
		if (!membersInbox || !addUserId) return;
		setAddingMember(true);
		try {
			await addInboxMemberAction(membersInbox.id, addUserId);
			const updated = await getInboxMembers(membersInbox.id);
			setMembers(updated);
			setAddUserId("");
		} finally {
			setAddingMember(false);
		}
	}

	async function handleRemoveMember(userId: string) {
		if (!membersInbox) return;
		await removeInboxMemberAction(membersInbox.id, userId).catch((err) => {
			console.error("[InboxSettings] failed to remove member:", err);
		});
		setMembers((prev) => prev.filter((m) => m.id !== userId));
	}

	const nonMembers = allUsers.filter((u) => !members.some((m) => m.id === u.id));
	const assignableUsers = assignUsers.filter((u) => !assignMembers.some((m) => m.id === u.id));
	const domainItems = domains.map((d) => ({ value: d.name, label: d.name }));

	// Group inboxes by domain
	const grouped = new Map<string, InboxType[]>();
	for (const inbox of inboxes) {
		const domain = inbox.email.split("@")[1] ?? "unknown";
		if (!grouped.has(domain)) grouped.set(domain, []);
		grouped.get(domain)!.push(inbox);
	}

	return (
		<PageShell>
			<PageHeader
				eyebrow="Mailboxes & Routing"
				title="Mailboxes"
				description="Addresses that receive mail, and the people who can open them."
				actions={
					<Button onClick={openCreate} disabled={domains.length === 0}>
						<Plus />
						<span>New Mailbox</span>
					</Button>
				}
			/>

			{!loading && domains.length === 0 && (
				<Alert variant="warning" className="flex items-center gap-2.5">
					<AlertTriangle className="shrink-0" />
					<AlertDescription className="flex-1 text-warning-muted-foreground">
						No domains configured — you need a domain before creating an inbox.
					</AlertDescription>
					<Button
						variant="link"
						size="sm"
						className="text-warning-muted-foreground"
						render={<Link href="/domains" />}
					>
						Set up a domain →
					</Button>
				</Alert>
			)}

			{loading ? (
				<div className="space-y-2">
					{[...Array(4)].map((_, i) => (
						<Skeleton key={i} className="h-12 rounded-lg" />
					))}
				</div>
			) : inboxes.length === 0 ? (
				domains.length === 0 ? (
					<Empty className="py-20">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Globe />
							</EmptyMedia>
							<EmptyTitle>No domains configured</EmptyTitle>
							<EmptyDescription>
								Add a domain to your account first — the inbox email address must belong to a domain in
								your system.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button variant="outline" render={<Link href="/domains" />}>
								Set up a domain →
							</Button>
						</EmptyContent>
					</Empty>
				) : (
					<Empty className="py-20">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Inbox />
							</EmptyMedia>
							<EmptyTitle>No mailboxes yet</EmptyTitle>
						</EmptyHeader>
						<EmptyContent>
							<Button variant="outline" onClick={openCreate}>
								Create a mailbox
							</Button>
						</EmptyContent>
					</Empty>
				)
			) : (
				<div className="flex flex-col gap-6">
					{Array.from(grouped.entries()).map(([domain, domainInboxes]) => (
						<div key={domain}>
							{/* Domain header */}
							<div className="mb-2 flex items-center gap-2">
								<Globe className="size-3.5 shrink-0 text-muted-foreground" />
								<span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
									{domain}
								</span>
								<span className="text-2xs text-muted-foreground">
									{domainInboxes.length} inbox{domainInboxes.length !== 1 ? "es" : ""}
								</span>
								<Separator className="ml-1 flex-1" />
							</div>
							{/* Inbox table for this domain */}
							<Card className="gap-0 overflow-hidden py-0">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Email address</TableHead>
											<TableHead>Display name</TableHead>
											<TableHead>Mode</TableHead>
											<TableHead>Routing</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{domainInboxes.map((inbox) => (
											<TableRow key={inbox.id}>
												<TableCell className="font-mono text-sm">{inbox.email}</TableCell>
												<TableCell className="text-sm">{inbox.display_name}</TableCell>
												<TableCell>
													<Badge variant="outline" className="capitalize">
														{inbox.mode}
													</Badge>
												</TableCell>
												<TableCell>
													{inbox.routing?.configured ? (
														<Badge variant="success">Active</Badge>
													) : (
														<div className="flex items-center gap-2">
															<Button
																size="sm"
																variant="outline"
																disabled={routingId === inbox.id}
																onClick={() => handleSetupRouting(inbox)}
															>
																{routingId === inbox.id && (
																	<Spinner data-icon="inline-start" />
																)}
																Setup routing
															</Button>
															{inbox.routing?.error && (
																<span
																	className="text-warning"
																	title={inbox.routing.error}
																	aria-label={inbox.routing.error}
																>
																	<AlertTriangle className="inline size-3.5" />
																</span>
															)}
														</div>
													)}
												</TableCell>
												<TableCell className="text-right">
													<div className="flex items-center justify-end gap-1">
														<Button
															size="sm"
															variant="ghost"
															onClick={() => openMembers(inbox)}
														>
															<Users />
															Members
														</Button>
														<Button
															size="icon-sm"
															variant="ghost"
															aria-label="Edit mailbox"
															onClick={() => openEdit(inbox)}
														>
															<Pencil />
														</Button>
														<Button
															size="icon-sm"
															variant="ghost"
															aria-label="Delete mailbox"
															onClick={() => setDeleteId(inbox.id)}
															className="text-muted-foreground hover:text-destructive"
														>
															<Trash2 />
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</Card>
						</div>
					))}
				</div>
			)}

			{/* ── Create wizard: 1 Inbox → 2 Routing → 3 Members ── */}
			<Dialog
				open={createOpen}
				onOpenChange={(open) => {
					if (!open) finishCreate();
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New inbox</DialogTitle>
						<div className="flex items-center gap-1 pt-1">
							{([1, 2, 3] as const).map((step) => (
								<div key={step} className="flex items-center gap-1">
									<span
										className={cn(
											"flex size-5 items-center justify-center rounded-full text-2xs font-semibold",
											createStep > step
												? "bg-success-muted text-success-muted-foreground"
												: createStep === step
													? "bg-primary text-primary-foreground"
													: "bg-muted text-muted-foreground",
										)}
									>
										{createStep > step ? <Check className="size-3" /> : step}
									</span>
									{step < 3 && (
										<span
											className={cn("h-px w-4", createStep > step ? "bg-success" : "bg-muted")}
										/>
									)}
								</div>
							))}
						</div>
					</DialogHeader>

					{/* Step 1 — Inbox details */}
					{createStep === 1 && (
						<div className="flex flex-col gap-4 py-2">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="inbox-local-part">Email address</Label>
								<div className="flex items-center gap-1.5">
									<Input
										id="inbox-local-part"
										className="flex-1"
										placeholder="support"
										value={localPart}
										onChange={(e) => setLocalPart(e.target.value.replace(/[@\s]/g, ""))}
										autoFocus
									/>
									<span className="text-sm text-muted-foreground select-none">@</span>
									<Select
										items={domainItems}
										value={selectedDomain}
										onValueChange={(v) => setSelectedDomain(v ?? "")}
									>
										<SelectTrigger className="w-44" aria-label="Domain">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{domainItems.map((d) => (
												<SelectItem key={d.value} value={d.value}>
													{d.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<p className="text-2xs text-muted-foreground">
									Must be configured in Cloudflare Email Routing
								</p>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="inbox-display-name">Display name</Label>
								<Input
									id="inbox-display-name"
									placeholder="Support"
									value={displayName}
									onChange={(e) => setDisplayName(e.target.value)}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label>Mode</Label>
								<ModeSelect value={mode} onValueChange={(v) => setMode(v as "thread" | "individual")} />
							</div>
						</div>
					)}

					{/* Step 2 — Routing result */}
					{createStep === 2 && createdInbox && (
						<div className="flex flex-col gap-4 py-2">
							{createdInbox.routing?.configured ? (
								<Alert variant="success" className="flex items-center gap-2.5">
									<Check className="shrink-0" />
									<AlertDescription className="text-success-muted-foreground">
										Email Routing is configured — inbound mail will be delivered to this inbox.
									</AlertDescription>
								</Alert>
							) : (
								<Alert variant="warning" className="flex flex-col gap-3">
									<div className="flex items-center gap-2.5">
										<AlertTriangle className="shrink-0" />
										<AlertDescription className="text-warning-muted-foreground">
											Email Routing couldn't be configured automatically.
										</AlertDescription>
									</div>
									{createdInbox.routing?.error && (
										<p className="text-xs break-words">{createdInbox.routing.error}</p>
									)}
									<Button
										size="sm"
										variant="outline"
										className="self-start"
										disabled={routingId === createdInbox.id}
										onClick={handleRetryRouting}
									>
										{routingId === createdInbox.id && <Spinner data-icon="inline-start" />}
										Retry setup
									</Button>
								</Alert>
							)}
							<p className="text-xs text-muted-foreground">
								You can also configure routing later from the inbox list.
							</p>
						</div>
					)}

					{/* Step 3 — User assignment */}
					{createStep === 3 && createdInbox && (
						<div className="flex flex-col gap-4 py-2">
							<p className="text-sm text-muted-foreground">
								Assign team members who can access{" "}
								<span className="font-mono text-foreground">{createdInbox.email}</span>.
							</p>

							{assignMembers.length > 0 && (
								<div className="flex flex-col gap-1">
									{assignMembers.map((u) => (
										<MemberRow
											key={u.id}
											user={u}
											className="bg-muted/50"
											onRemove={() =>
												setAssignMembers((prev) => prev.filter((m) => m.id !== u.id))
											}
										/>
									))}
								</div>
							)}

							{assignableUsers.length === 0 ? (
								<p className="text-xs text-muted-foreground">All users are already members</p>
							) : (
								<UserPicker
									users={assignableUsers}
									value={assignUserId}
									onValueChange={setAssignUserId}
									onAdd={handleAssignMember}
									adding={assignAdding}
								/>
							)}

							<p className="text-xs text-muted-foreground">
								You can add or remove members later from the inbox list.
							</p>
						</div>
					)}

					<DialogFooter>
						{createStep > 1 && (
							<Button
								variant="outline"
								onClick={() => setCreateStep((prev) => (prev - 1) as 1 | 2 | 3)}
								disabled={creating || routingId === createdInbox?.id}
							>
								Back
							</Button>
						)}
						{createStep === 1 && (
							<Button
								onClick={handleCreateInbox}
								disabled={creating || !localPart.trim() || !selectedDomain || !displayName.trim()}
							>
								{creating && <Spinner data-icon="inline-start" />}
								{creating ? "Creating…" : "Create"}
							</Button>
						)}
						{createStep === 2 && (
							<Button onClick={goToAssign} disabled={routingId === createdInbox?.id}>
								Continue
							</Button>
						)}
						{createStep === 3 && <Button onClick={finishCreate}>Finish</Button>}
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Edit dialog */}
			<Dialog
				open={!!editing}
				onOpenChange={(open) => {
					if (!open) setEditing(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit inbox</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4 py-2">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="edit-inbox-display-name">Display name</Label>
							<Input
								id="edit-inbox-display-name"
								placeholder="Support"
								value={displayName}
								onChange={(e) => setDisplayName(e.target.value)}
								autoFocus
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label>Mode</Label>
							<ModeSelect value={mode} onValueChange={(v) => setMode(v as "thread" | "individual")} />
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setEditing(null)}>
							Cancel
						</Button>
						<Button onClick={handleEditSave} disabled={saving || !displayName.trim()}>
							{saving && <Spinner data-icon="inline-start" />}
							{saving ? "Saving…" : "Save changes"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Members Sheet */}
			<Sheet open={!!membersInbox} onOpenChange={(open) => !open && setMembersInbox(null)}>
				<SheetContent className="w-[420px] px-6 sm:max-w-[420px]">
					<SheetHeader>
						<SheetTitle>Members — {membersInbox?.display_name}</SheetTitle>
					</SheetHeader>

					<div className="flex flex-col gap-4 py-5">
						{loadingMembers ? (
							<div className="space-y-2">
								{[...Array(3)].map((_, i) => (
									<Skeleton key={i} className="h-10 rounded-lg" />
								))}
							</div>
						) : (
							<>
								{/* Current members */}
								{members.length === 0 ? (
									<p className="py-4 text-center text-sm text-muted-foreground">
										No members assigned yet
									</p>
								) : (
									<div className="flex flex-col gap-1">
										{members.map((u) => (
											<MemberRow
												key={u.id}
												user={u}
												className="hover:bg-muted/50"
												onRemove={() => handleRemoveMember(u.id)}
											/>
										))}
									</div>
								)}

								<Separator />

								{/* Add member */}
								<div className="flex flex-col gap-2">
									<Label className="text-xs">Add member</Label>
									{nonMembers.length === 0 ? (
										<p className="text-xs text-muted-foreground">All users are already members</p>
									) : (
										<UserPicker
											users={nonMembers}
											value={addUserId}
											onValueChange={setAddUserId}
											onAdd={handleAddMember}
											adding={addingMember}
										/>
									)}
								</div>
							</>
						)}
					</div>
				</SheetContent>
			</Sheet>

			{/* Delete confirm */}
			<Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete inbox?</DialogTitle>
						<DialogDescription>
							All associated emails and threads will be permanently deleted. This cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteId(null)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDelete} disabled={deleting}>
							{deleting && <Spinner data-icon="inline-start" />}
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</PageShell>
	);
}
