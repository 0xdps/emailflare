"use client";

import React, { useEffect, useState } from "react";
import { Plus, Loader2, Users, Trash2, Copy, Check, Shield, Wrench, Edit2 } from "lucide-react";
import { getUsers, User, UserType, AccessType } from "@/lib/api";
import { createInviteAction, revokeUserAction, changeUserPermissionsAction } from "@/app/actions/users";
import { usePermissions } from "@/lib/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

function UserTypeBadge({ userType }: { userType: UserType }) {
	if (userType === "admin") {
		return (
			<Badge className="text-[10px] h-4.5 px-2 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
				admin
			</Badge>
		);
	}
	return (
		<Badge variant="secondary" className="text-[10px] h-4.5 px-2 text-zinc-600 dark:text-zinc-300">
			member
		</Badge>
	);
}

function AccessBadges({ accessTypes, userType }: { accessTypes: AccessType[]; userType: UserType }) {
	if (userType === "admin") {
		return <span className="text-xs text-muted-foreground italic">Full access (all capabilities)</span>;
	}

	const list = accessTypes ?? ["inbox"];
	return (
		<div className="flex items-center gap-1.5 flex-wrap">
			<Badge
				variant="outline"
				className="text-[10px] h-4 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
			>
				inbox
			</Badge>
			{list.includes("api") && (
				<Badge
					variant="outline"
					className="text-[10px] h-4 px-1.5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
				>
					api
				</Badge>
			)}
			{list.includes("tester") && (
				<Badge
					variant="outline"
					className="text-[10px] h-4 px-1.5 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300"
				>
					test inbox
				</Badge>
			)}
		</div>
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
	const [inviteCanApi, setInviteCanApi] = useState(false);
	const [inviteCanTest, setInviteCanTest] = useState(false);
	const [inviteUrl, setInviteUrl] = useState("");
	const [inviting, setInviting] = useState(false);
	const [inviteError, setInviteError] = useState("");
	const [copied, setCopied] = useState(false);

	// Edit user permissions state
	const [editUser, setEditUser] = useState<User | null>(null);
	const [editUserType, setEditUserType] = useState<UserType>("member");
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
			const accessTypes: AccessType[] = ["inbox"];
			if (inviteCanApi) accessTypes.push("api");
			if (inviteCanTest) accessTypes.push("tester");

			const { inviteUrl: url } = await createInviteAction(inviteEmail.trim(), inviteUserType, accessTypes);
			setInviteUrl(url);
		} catch (err: any) {
			const msg = err?.message;
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
		setInviteCanApi(false);
		setInviteCanTest(false);
		setInviteUrl("");
		setInviteError("");
		setCopied(false);
	}

	async function copyInviteUrl() {
		await navigator.clipboard.writeText(inviteUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	function openEdit(user: User) {
		setEditUser(user);
		setEditUserType(user.user_type);
		const acts = Array.isArray(user.access_types) ? user.access_types : [];
		setEditCanApi(acts.includes("api"));
		setEditCanTest(acts.includes("tester"));
		setEditError("");
	}

	async function handleSavePermissions() {
		if (!editUser) return;
		setSavingPermissions(true);
		setEditError("");
		try {
			const accessTypes: AccessType[] = ["inbox"];
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
		} catch (err: any) {
			setEditError(err?.message || "Failed to update permissions.");
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
		<div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<div className="flex items-center gap-2 mb-1">
						<Users size={14} className="text-orange-500" />
						<span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
							Access Control
						</span>
					</div>
					<h1 className="text-2xl font-bold tracking-tight text-foreground">Team Users & Permissions</h1>
					<p className="text-xs text-muted-foreground mt-0.5">
						Manage administrative authority and additive capabilities for organization members.
					</p>
				</div>
				<Button onClick={() => setInviteOpen(true)} className="gap-1.5 text-xs h-8.5 shadow-xs">
					<Plus size={14} />
					<span>Invite User</span>
				</Button>
			</div>

			{loading ? (
				<div className="flex justify-center py-16">
					<Loader2 size={20} className="animate-spin text-muted-foreground" />
				</div>
			) : (
				<div className="rounded-xl border border-border overflow-hidden bg-card">
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
								const accessTypes = user.access_types ?? ["inbox"];
								const isSelf = currentUser?.id === user.id;

								return (
									<TableRow key={user.id}>
										<TableCell>
											<div className="font-medium text-sm text-foreground">{user.name}</div>
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
												<Button
													size="sm"
													variant="ghost"
													onClick={() => openEdit(user)}
													className="h-7 px-2 text-xs"
												>
													<Edit2 size={12} className="mr-1" />
													Permissions
												</Button>
												{!isSelf && (
													<Button
														size="sm"
														variant="ghost"
														onClick={() => setRevokeId(user.id)}
														className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
													>
														<Trash2 size={12} />
													</Button>
												)}
											</div>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			)}

			{/* ── Edit Permissions Dialog ── */}
			<Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit User Permissions</DialogTitle>
					</DialogHeader>

					{editUser && (
						<div className="flex flex-col gap-4 py-2">
							<div className="rounded-lg bg-muted/50 p-3 text-xs flex flex-col gap-1">
								<span className="font-semibold text-foreground">{editUser.name}</span>
								<span className="text-muted-foreground">{editUser.email}</span>
							</div>

							<div className="flex flex-col gap-1.5">
								<Label htmlFor="edit-user-type">User Type (Administrative Authority)</Label>
								<Select value={editUserType} onValueChange={(val) => setEditUserType(val as UserType)}>
									<SelectTrigger id="edit-user-type" className="h-9 text-sm">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="member">Member — Regular application user</SelectItem>
										<SelectItem value="admin">Admin — Full platform administration</SelectItem>
									</SelectContent>
								</Select>
							</div>

							{editUserType === "admin" ? (
								<p className="text-xs text-muted-foreground italic bg-amber-50/50 border border-amber-200/60 rounded p-2.5 dark:bg-amber-950/20 dark:border-amber-900">
									Administrators automatically receive full authority across all dashboards,
									mailboxes, and settings.
								</p>
							) : (
								<div className="flex flex-col gap-2 pt-1">
									<Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
										Product Capabilities
									</Label>
									<div className="space-y-2.5 rounded-lg border border-border p-3">
										<div className="flex items-center gap-2.5">
											<Checkbox id="edit-cap-inbox" checked disabled />
											<label
												htmlFor="edit-cap-inbox"
												className="text-xs font-medium cursor-not-allowed"
											>
												Production Inbox{" "}
												<span className="text-muted-foreground font-normal">
													(Included by default)
												</span>
											</label>
										</div>
										<div className="flex items-center gap-2.5">
											<Checkbox
												id="edit-cap-api"
												checked={editCanApi}
												onCheckedChange={(checked) => setEditCanApi(!!checked)}
											/>
											<label
												htmlFor="edit-cap-api"
												className="text-xs font-medium cursor-pointer"
											>
												API Dashboard{" "}
												<span className="text-muted-foreground font-normal">
													(Logs, templates, playground, keys)
												</span>
											</label>
										</div>
										<div className="flex items-center gap-2.5">
											<Checkbox
												id="edit-cap-test"
												checked={editCanTest}
												onCheckedChange={(checked) => setEditCanTest(!!checked)}
											/>
											<label
												htmlFor="edit-cap-test"
												className="text-xs font-medium cursor-pointer"
											>
												Test Inbox{" "}
												<span className="text-muted-foreground font-normal">
													(Virtual testing folder inside Inbox)
												</span>
											</label>
										</div>
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
									{savingPermissions && <Loader2 size={13} className="animate-spin mr-1.5" />}
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
									value={inviteUserType}
									onValueChange={(val) => setInviteUserType(val as UserType)}
								>
									<SelectTrigger id="invite-user-type" className="h-9 text-sm">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="member">Member — Regular user</SelectItem>
										<SelectItem value="admin">Admin — Full platform administration</SelectItem>
									</SelectContent>
								</Select>
							</div>

							{inviteUserType === "admin" ? (
								<p className="text-xs text-muted-foreground italic bg-amber-50/50 border border-amber-200/60 rounded p-2.5 dark:bg-amber-950/20 dark:border-amber-900">
									Administrators automatically receive full authority across all dashboards,
									mailboxes, and settings.
								</p>
							) : (
								<div className="flex flex-col gap-2 pt-1">
									<Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
										Capabilities
									</Label>
									<div className="space-y-2.5 rounded-lg border border-border p-3">
										<div className="flex items-center gap-2.5">
											<Checkbox id="invite-cap-inbox" checked disabled />
											<label
												htmlFor="invite-cap-inbox"
												className="text-xs font-medium cursor-not-allowed"
											>
												Production Inbox{" "}
												<span className="text-muted-foreground font-normal">
													(Included by default)
												</span>
											</label>
										</div>
										<div className="flex items-center gap-2.5">
											<Checkbox
												id="invite-cap-api"
												checked={inviteCanApi}
												onCheckedChange={(checked) => setInviteCanApi(!!checked)}
											/>
											<label
												htmlFor="invite-cap-api"
												className="text-xs font-medium cursor-pointer"
											>
												API Dashboard{" "}
												<span className="text-muted-foreground font-normal">
													(Logs, templates, playground, keys)
												</span>
											</label>
										</div>
										<div className="flex items-center gap-2.5">
											<Checkbox
												id="invite-cap-test"
												checked={inviteCanTest}
												onCheckedChange={(checked) => setInviteCanTest(!!checked)}
											/>
											<label
												htmlFor="invite-cap-test"
												className="text-xs font-medium cursor-pointer"
											>
												Test Inbox{" "}
												<span className="text-muted-foreground font-normal">
													(Virtual testing folder)
												</span>
											</label>
										</div>
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
									{inviting && <Loader2 size={13} className="animate-spin mr-1.5" />}
									{inviting ? "Creating invite…" : "Create invite"}
								</Button>
							</DialogFooter>
						</div>
					) : (
						<div className="flex flex-col gap-4 py-2">
							<p className="text-sm text-muted-foreground">
								Share this invite link with{" "}
								<span className="font-medium text-foreground">{inviteEmail}</span>. It expires in 48
								hours and can only be used once.
							</p>
							<div className="flex gap-2">
								<Input value={inviteUrl} readOnly className="font-mono text-xs flex-1" />
								<Button size="sm" variant="outline" onClick={copyInviteUrl} className="shrink-0">
									{copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
								</Button>
							</div>
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
					</DialogHeader>
					<p className="text-sm text-muted-foreground">
						This user will immediately lose access. Their data (emails, threads) will be retained.
					</p>
					<DialogFooter>
						<Button variant="outline" onClick={() => setRevokeId(null)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleRevoke} disabled={revoking}>
							{revoking && <Loader2 size={13} className="animate-spin mr-1.5" />}
							Revoke access
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
