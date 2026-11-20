"use client";

import React, { useEffect, useState } from "react";
import { Plus, Users, Trash2, Copy, Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { getUsers, User, UserType, AccessType } from "@/lib/api";
import { createInviteAction, revokeUserAction, changeUserPermissionsAction } from "@/app/actions/users";
import { usePermissions } from "@/lib/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { PageHeader, PageShell } from "@/components/app/PageHeader";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

const EDIT_USER_TYPE_ITEMS = [
	{ value: "member", label: "Member — Regular application user" },
	{ value: "admin", label: "Admin — Full platform administration" },
];

const INVITE_USER_TYPE_ITEMS = [
	{ value: "member", label: "Member — Regular user" },
	{ value: "admin", label: "Admin — Full platform administration" },
];

function UserTypeBadge({ userType }: { userType: UserType }) {
	if (userType === "admin") return <Badge variant="warning">admin</Badge>;
	return <Badge variant="secondary">member</Badge>;
}

function AccessBadges({ accessTypes, userType }: { accessTypes: AccessType[]; userType: UserType }) {
	if (userType === "admin") {
		return <span className="text-xs text-muted-foreground italic">Full access (all capabilities)</span>;
	}

	const list = accessTypes ?? [];
	if (list.length === 0) {
		return <span className="text-xs text-muted-foreground italic">No capabilities</span>;
	}

	return (
		<div className="flex flex-wrap items-center gap-1.5">
			{list.includes("inbox") && <Badge variant="success">inbox</Badge>}
			{list.includes("api") && <Badge variant="info">api</Badge>}
			{list.includes("tester") && <Badge variant="soft">test inbox</Badge>}
		</div>
	);
}

function CapabilityCheckbox({
	id,
	checked,
	onCheckedChange,
	label,
	hint,
}: {
	id: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	label: string;
	hint: string;
}) {
	return (
		<div className="flex items-center gap-2.5">
			<Checkbox id={id} checked={checked} onCheckedChange={(value) => onCheckedChange(!!value)} />
			<Label htmlFor={id} className="cursor-pointer text-xs">
				<span>
					{label} <span className="font-normal text-muted-foreground">{hint}</span>
				</span>
			</Label>
		</div>
	);
}

function AdminNote() {
	return (
		<Alert variant="warning">
			<AlertDescription className="text-xs text-warning-muted-foreground italic">
				Administrators automatically receive full authority across all dashboards, mailboxes, and settings.
			</AlertDescription>
		</Alert>
	);
}

export interface UsersPageProps {
	initialUsers?: User[];
}

export default function UsersPage({ initialUsers }: UsersPageProps = {}) {
	const { user: currentUser } = usePermissions();
	const [users, setUsers] = useState<User[]>(initialUsers ?? []);
	const [loading, setLoading] = useState(!initialUsers);

	// Invite state
	const [inviteOpen, setInviteOpen] = useState(false);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteUserType, setInviteUserType] = useState<UserType>("member");
	const [inviteCanInbox, setInviteCanInbox] = useState(true);
	const [inviteCanApi, setInviteCanApi] = useState(false);
	const [inviteCanTest, setInviteCanTest] = useState(false);
	const [inviteUrl, setInviteUrl] = useState("");
	const [inviteEmailed, setInviteEmailed] = useState(false);
	const [inviting, setInviting] = useState(false);
	const [inviteError, setInviteError] = useState("");
	const [copied, setCopied] = useState(false);

	// Edit user permissions state
	const [editUser, setEditUser] = useState<User | null>(null);
	const [editUserType, setEditUserType] = useState<UserType>("member");
	const [editCanInbox, setEditCanInbox] = useState(true);
	const [editCanApi, setEditCanApi] = useState(false);
	const [editCanTest, setEditCanTest] = useState(false);
	const [savingPermissions, setSavingPermissions] = useState(false);
	const [editError, setEditError] = useState("");

	// Revoke state
	const [revokeId, setRevokeId] = useState<string | null>(null);
	const [revoking, setRevoking] = useState(false);

	useEffect(() => {
		if (!initialUsers) {
			getUsers()
				.then(setUsers)
				.finally(() => setLoading(false));
		}
	}, [initialUsers]);

	async function handleInvite() {
		setInviteError("");
		setInviting(true);
		try {
			const accessTypes: AccessType[] = [];
			if (inviteCanInbox) accessTypes.push("inbox");
			if (inviteCanApi) accessTypes.push("api");
			if (inviteCanTest) accessTypes.push("tester");

			const { inviteUrl: url, emailed } = await createInviteAction(
				inviteEmail.trim(),
				inviteUserType,
				accessTypes,
			);
			setInviteUrl(url);
			setInviteEmailed(emailed);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "";
			if (msg === "already_exists") setInviteError("A user with that email already exists.");
			else setInviteError("Failed to create invite. Please try again.");
		} finally {
			setInviting(false);
		}
	}

	function closeInviteDialog() {
		setInviteOpen(false);
		setInviteEmail("");
		setInviteUserType("member");
		setInviteCanInbox(true);
		setInviteCanApi(false);
		setInviteCanTest(false);
		setInviteUrl("");
		setInviteEmailed(false);
		setInviteError("");
		setCopied(false);
	}

	async function copyInviteUrl() {
		await navigator.clipboard.writeText(inviteUrl);
		toast.success("Invite link copied");
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	function openEdit(user: User) {
		setEditUser(user);
		setEditUserType(user.user_type);
		const acts = Array.isArray(user.access_types) ? user.access_types : [];
		setEditCanInbox(acts.includes("inbox"));
		setEditCanApi(acts.includes("api"));
		setEditCanTest(acts.includes("tester"));
		setEditError("");
	}

	async function handleSavePermissions() {
		if (!editUser) return;
		setSavingPermissions(true);
		setEditError("");
		try {
			const accessTypes: AccessType[] = [];
			if (editCanInbox) accessTypes.push("inbox");
			if (editCanApi) accessTypes.push("api");
			if (editCanTest) accessTypes.push("tester");

			await changeUserPermissionsAction(editUser.id, editUserType, accessTypes);
			setUsers((prev) =>
				prev.map((u) =>
					u.id === editUser.id
						? {
								...u,
								user_type: editUserType,
								access_types: editUserType === "admin" ? ["inbox", "api", "tester"] : accessTypes,
							}
						: u,
				),
			);
			setEditUser(null);
		} catch (err: unknown) {
			setEditError(err instanceof Error ? err.message : "Failed to update permissions.");
		} finally {
			setSavingPermissions(false);
		}
	}

	async function handleRevoke() {
		if (!revokeId) return;
		setRevoking(true);
		try {
			await revokeUserAction(revokeId);
			setUsers((prev) => prev.filter((u) => u.id !== revokeId));
			setRevokeId(null);
		} finally {
			setRevoking(false);
		}
	}

	return (
		<PageShell>
			<PageHeader
				eyebrow="Access Control"
				title="Team"
				description="Invite people and choose whether they can use the inbox, API, or test mailbox."
				actions={
					<Button onClick={() => setInviteOpen(true)}>
						<Plus />
						<span>Invite User</span>
					</Button>
				}
			/>

			{loading ? (
				<Card className="gap-0 p-4">
					<div className="space-y-2">
						{[...Array(4)].map((_, i) => (
							<Skeleton key={i} className="h-12 rounded-lg" />
						))}
					</div>
				</Card>
			) : users.length === 0 ? (
				<Card className="gap-0 py-0">
					<Empty className="py-16">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Users />
							</EmptyMedia>
							<EmptyTitle>No users yet</EmptyTitle>
							<EmptyDescription>Invite people to give them access to EmailFlare.</EmptyDescription>
						</EmptyHeader>
					</Empty>
				</Card>
			) : (
				<Card className="gap-0 overflow-hidden py-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>User</TableHead>
								<TableHead>Authority</TableHead>
								<TableHead>Capabilities</TableHead>
								<TableHead>Joined</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{users.map((user) => {
								const userType: UserType = user.user_type;
								const accessTypes = user.access_types ?? [];
								const isSelf = currentUser?.id === user.id;

								return (
									<TableRow key={user.id}>
										<TableCell>
											<div className="text-sm font-medium text-foreground">{user.name}</div>
											<div className="text-xs text-muted-foreground">{user.email}</div>
										</TableCell>
										<TableCell>
											<UserTypeBadge userType={userType} />
										</TableCell>
										<TableCell>
											<AccessBadges accessTypes={accessTypes} userType={userType} />
										</TableCell>
										<TableCell className="text-xs text-muted-foreground">
											{new Date(user.created_at).toLocaleDateString(undefined, {
												month: "short",
												day: "numeric",
												year: "numeric",
											})}
										</TableCell>
										<TableCell className="text-right">
											<div className="flex items-center justify-end gap-1">
												<Button size="sm" variant="ghost" onClick={() => openEdit(user)}>
													<Pencil />
													Permissions
												</Button>
												{!isSelf && (
													<Button
														size="icon-sm"
														variant="ghost"
														aria-label="Revoke access"
														onClick={() => setRevokeId(user.id)}
														className="text-muted-foreground hover:text-destructive"
													>
														<Trash2 />
													</Button>
												)}
											</div>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</Card>
			)}

			{/* ── Edit Permissions Dialog ── */}
			<Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit User Permissions</DialogTitle>
					</DialogHeader>

					{editUser && (
						<div className="flex flex-col gap-4 py-2">
							<div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3 text-xs">
								<span className="font-semibold text-foreground">{editUser.name}</span>
								<span className="text-muted-foreground">{editUser.email}</span>
							</div>

							<div className="flex flex-col gap-1.5">
								<Label htmlFor="edit-user-type">User Type (Administrative Authority)</Label>
								<Select
									items={EDIT_USER_TYPE_ITEMS}
									value={editUserType}
									onValueChange={(val) => setEditUserType(val as UserType)}
								>
									<SelectTrigger id="edit-user-type" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{EDIT_USER_TYPE_ITEMS.map((o) => (
											<SelectItem key={o.value} value={o.value}>
												{o.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{editUserType === "admin" ? (
								<AdminNote />
							) : (
								<div className="flex flex-col gap-2 pt-1">
									<Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
										Product Capabilities
									</Label>
									<div className="space-y-2.5 rounded-lg border border-border p-3">
										<CapabilityCheckbox
											id="edit-cap-inbox"
											checked={editCanInbox}
											onCheckedChange={setEditCanInbox}
											label="Production Inbox"
											hint="(Mailbox, threads, compose)"
										/>
										<CapabilityCheckbox
											id="edit-cap-api"
											checked={editCanApi}
											onCheckedChange={setEditCanApi}
											label="API Dashboard"
											hint="(Logs, templates, playground, keys)"
										/>
										<CapabilityCheckbox
											id="edit-cap-test"
											checked={editCanTest}
											onCheckedChange={setEditCanTest}
											label="Test Inbox"
											hint="(Virtual testing folder inside Inbox)"
										/>
									</div>
								</div>
							)}

							{editError && (
								<Alert variant="destructive">
									<AlertDescription>{editError}</AlertDescription>
								</Alert>
							)}

							<DialogFooter>
								<Button variant="outline" onClick={() => setEditUser(null)}>
									Cancel
								</Button>
								<Button onClick={handleSavePermissions} disabled={savingPermissions}>
									{savingPermissions && <Spinner data-icon="inline-start" />}
									Save changes
								</Button>
							</DialogFooter>
						</div>
					)}
				</DialogContent>
			</Dialog>

			{/* ── Invite Dialog ── */}
			<Dialog open={inviteOpen} onOpenChange={(open) => !open && closeInviteDialog()}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Invite user</DialogTitle>
					</DialogHeader>

					{!inviteUrl ? (
						<div className="flex flex-col gap-4 py-2">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="invite-email">Email address</Label>
								<Input
									id="invite-email"
									type="email"
									value={inviteEmail}
									onChange={(e) => setInviteEmail(e.target.value)}
									placeholder="colleague@example.com"
									autoFocus
									onKeyDown={(e) => e.key === "Enter" && inviteEmail.trim() && handleInvite()}
								/>
							</div>

							<div className="flex flex-col gap-1.5">
								<Label htmlFor="invite-user-type">User Type</Label>
								<Select
									items={INVITE_USER_TYPE_ITEMS}
									value={inviteUserType}
									onValueChange={(val) => setInviteUserType(val as UserType)}
								>
									<SelectTrigger id="invite-user-type" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{INVITE_USER_TYPE_ITEMS.map((o) => (
											<SelectItem key={o.value} value={o.value}>
												{o.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{inviteUserType === "admin" ? (
								<AdminNote />
							) : (
								<div className="flex flex-col gap-2 pt-1">
									<Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
										Capabilities
									</Label>
									<div className="space-y-2.5 rounded-lg border border-border p-3">
										<CapabilityCheckbox
											id="invite-cap-inbox"
											checked={inviteCanInbox}
											onCheckedChange={setInviteCanInbox}
											label="Production Inbox"
											hint="(Mailbox, threads, compose)"
										/>
										<CapabilityCheckbox
											id="invite-cap-api"
											checked={inviteCanApi}
											onCheckedChange={setInviteCanApi}
											label="API Dashboard"
											hint="(Logs, templates, playground, keys)"
										/>
										<CapabilityCheckbox
											id="invite-cap-test"
											checked={inviteCanTest}
											onCheckedChange={setInviteCanTest}
											label="Test Inbox"
											hint="(Virtual testing folder)"
										/>
									</div>
								</div>
							)}

							{inviteError && (
								<Alert variant="destructive">
									<AlertDescription>{inviteError}</AlertDescription>
								</Alert>
							)}

							<DialogFooter>
								<Button variant="outline" onClick={closeInviteDialog}>
									Cancel
								</Button>
								<Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
									{inviting && <Spinner data-icon="inline-start" />}
									{inviting ? "Creating invite…" : "Create invite"}
								</Button>
							</DialogFooter>
						</div>
					) : (
						<div className="flex flex-col gap-4 py-2">
							<p className="text-sm text-muted-foreground">
								{inviteEmailed
									? "The invite was emailed. The link is also here if you need to share it directly."
									: "Email could not be sent. Share this link directly."}{" "}
								It expires in 48 hours and can only be used once.
							</p>
							<InputGroup>
								<InputGroupInput
									value={inviteUrl}
									readOnly
									aria-label="Invite link"
									className="font-mono text-xs"
								/>
								<InputGroupAddon align="inline-end">
									<InputGroupButton
										size="icon-xs"
										aria-label="Copy invite link"
										onClick={copyInviteUrl}
									>
										{copied ? <Check className="text-success" /> : <Copy />}
									</InputGroupButton>
								</InputGroupAddon>
							</InputGroup>
							<DialogFooter>
								<Button onClick={closeInviteDialog}>Done</Button>
							</DialogFooter>
						</div>
					)}
				</DialogContent>
			</Dialog>

			{/* ── Revoke Confirm Dialog ── */}
			<Dialog open={!!revokeId} onOpenChange={(open) => !open && setRevokeId(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Revoke access?</DialogTitle>
						<DialogDescription>
							This user will immediately lose access. Their data (emails, threads) will be retained.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setRevokeId(null)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleRevoke} disabled={revoking}>
							{revoking && <Spinner data-icon="inline-start" />}
							Revoke access
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</PageShell>
	);
}
