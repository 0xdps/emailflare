"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Copy, Mail, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
	enableReceivingAction,
	fixDomainRecordsAction,
	getDomainHealthAction,
	getDomainRecordsAction,
	removeDomainAction,
	sendDomainTestEmailAction,
} from "@/app/actions/domains";
import { createInboxAction } from "@/app/actions/inboxes";
import { PageHeader, PageShell } from "@/components/app/PageHeader";
import HealthChips from "@/components/modules/domains/HealthChips";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { healthHint, mailboxDomains, type DomainHealth, type RecordCheck } from "@/lib/core/domain-health";
import { relativeTime } from "@/lib/inbox/format";
import type { DomainDetailData } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

const SUGGESTED_MAILBOXES = ["support", "hello", "privacy", "billing"];

const RECORD_BADGE: Record<RecordCheck["status"], { label: string; variant: "success" | "warning" | "destructive" }> = {
	ok: { label: "Found", variant: "success" },
	missing: { label: "Missing", variant: "destructive" },
	wrong: { label: "Different value", variant: "warning" },
};

function copyText(text: string, label: string) {
	navigator.clipboard.writeText(text).then(
		() => toast.success(`${label} copied`),
		() => toast.error("Could not copy to clipboard"),
	);
}

export default function DomainDetail({ detail, adminEmail }: { detail: DomainDetailData; adminEmail: string }) {
	const { domain, mailboxes, zoneSiblings, lastInboundAt } = detail;
	const router = useRouter();
	const [tab, setTab] = useState("overview");
	const [health, setHealth] = useState<DomainHealth | undefined>();
	const [recheck, setRecheck] = useState(false);

	const loadHealth = useCallback(
		async (fresh = false) => {
			setRecheck(true);
			try {
				const rows = await getDomainHealthAction({ fresh });
				setHealth(rows.find((row) => row.id === domain.id));
			} catch {
				toast.error("Could not check Cloudflare, so the status is unknown.");
			} finally {
				setRecheck(false);
			}
		},
		[domain.id],
	);

	useEffect(() => {
		void loadHealth();
	}, [loadHealth]);

	return (
		<PageShell>
			<Link href="/domains" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 w-fit")}>
				<ArrowLeft /> Domains
			</Link>

			<PageHeader
				eyebrow="Domain"
				title={domain.name}
				actions={
					<Button variant="outline" disabled={recheck} onClick={() => void loadHealth(true)}>
						<RefreshCw className={recheck ? "animate-spin" : ""} />
						Re-check
					</Button>
				}
			/>

			<HealthChips health={health} />

			<Tabs value={tab} onValueChange={setTab}>
				<TabsList variant="line">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="dns">DNS records</TabsTrigger>
					<TabsTrigger value="mailboxes">Mailboxes ({mailboxes.length})</TabsTrigger>
					<TabsTrigger value="settings">Settings</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="pt-4">
					<Overview
						domainId={domain.id}
						domainName={domain.name}
						health={health}
						mailboxCount={mailboxes.length}
						lastInboundAt={lastInboundAt}
						adminEmail={adminEmail}
						onGo={setTab}
						onChanged={() => void loadHealth(true)}
					/>
				</TabsContent>
				<TabsContent value="dns" className="pt-4">
					<DnsRecords domainId={domain.id} active={tab === "dns"} onChanged={() => void loadHealth(true)} />
				</TabsContent>
				<TabsContent value="mailboxes" className="pt-4">
					<Mailboxes
						domainName={domain.name}
						mailboxes={mailboxes}
						receiving={health?.receiving}
						onChanged={() => {
							router.refresh();
							void loadHealth(true);
						}}
					/>
				</TabsContent>
				<TabsContent value="settings" className="pt-4">
					<Settings
						domainId={domain.id}
						domainName={domain.name}
						mailboxCount={mailboxes.length}
						zoneSiblings={zoneSiblings}
						onRemoved={() => router.push("/domains")}
					/>
				</TabsContent>
			</Tabs>
		</PageShell>
	);
}

// ── Overview ──────────────────────────────────────────────────────────────────

function Overview({
	domainId,
	domainName,
	health,
	mailboxCount,
	lastInboundAt,
	adminEmail,
	onGo,
	onChanged,
}: {
	domainId: string;
	domainName: string;
	health: DomainHealth | undefined;
	mailboxCount: number;
	lastInboundAt: string | null;
	adminEmail: string;
	onGo: (tab: string) => void;
	onChanged: () => void;
}) {
	const [testing, setTesting] = useState(false);
	const [confirmReceiving, setConfirmReceiving] = useState(false);
	const [enabling, setEnabling] = useState(false);
	const hint = health ? healthHint(health) : null;
	const needsReceiving = health && health.receiving !== "ready" && health.receiving !== "unknown";

	async function sendTest() {
		setTesting(true);
		try {
			const result = await sendDomainTestEmailAction(domainId);
			if (result.ok) toast.success(`Test email sent to ${adminEmail}`);
			else toast.error(result.error);
		} finally {
			setTesting(false);
		}
	}

	async function turnOnReceiving() {
		setEnabling(true);
		try {
			const result = await enableReceivingAction(domainId);
			if (result.ok) {
				toast.success("Incoming mail now goes to this inbox");
				setConfirmReceiving(false);
				onChanged();
			} else toast.error(result.error);
		} finally {
			setEnabling(false);
		}
	}

	const steps = [
		{
			done: health?.sending === "ready",
			title: "Sending is confirmed",
			detail: "Cloudflare has verified the DNS records.",
			action: health?.sending === "ready" ? null : { label: "Check DNS records", onClick: () => onGo("dns") },
		},
		{
			done: health?.receiving === "ready",
			title: "Receiving is routed to this inbox",
			detail: "The zone's catch-all delivers incoming mail here.",
			action: needsReceiving ? { label: "Turn on receiving", onClick: () => setConfirmReceiving(true) } : null,
		},
		{
			done: mailboxCount > 0,
			title: "At least one mailbox exists",
			detail: "Mailboxes decide who sees which mail.",
			action: mailboxCount > 0 ? null : { label: "Add a mailbox", onClick: () => onGo("mailboxes") },
		},
	];

	return (
		<div className="space-y-4">
			{hint && (
				<Alert variant="warning">
					<AlertTriangle />
					<AlertDescription>{hint}</AlertDescription>
				</Alert>
			)}

			<Card>
				<CardContent className="space-y-3">
					<p className="text-sm font-medium">Setup checklist</p>
					<ul className="space-y-2">
						{steps.map((step) => (
							<li key={step.title} className="flex items-start gap-3 rounded-lg border p-3">
								<div
									className={cn(
										"mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
										step.done
											? "bg-success-muted text-success-muted-foreground"
											: "bg-muted text-muted-foreground",
									)}
								>
									{step.done ? (
										<Check className="size-3" />
									) : (
										<span className="size-1.5 rounded-full bg-current" />
									)}
								</div>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-medium">{step.title}</p>
									<p className="text-2xs text-muted-foreground">{step.detail}</p>
								</div>
								{!step.done && step.action && (
									<Button size="sm" variant="outline" onClick={step.action.onClick}>
										{step.action.label}
									</Button>
								)}
							</li>
						))}
					</ul>
				</CardContent>
			</Card>

			<div className="grid gap-4 sm:grid-cols-2">
				<Card>
					<CardContent className="space-y-2">
						<p className="text-sm font-medium">Send a test email</p>
						<p className="text-xs text-muted-foreground">
							Sends a message from test@{domainName} to {adminEmail}. Reply to it to check receiving too.
						</p>
						<Button
							size="sm"
							disabled={testing || health?.sending !== "ready"}
							onClick={() => void sendTest()}
						>
							{testing ? <Spinner /> : <Send />}
							Send test
						</Button>
						{health && health.sending !== "ready" && (
							<p className="text-2xs text-muted-foreground">Available once sending is confirmed.</p>
						)}
					</CardContent>
				</Card>
				<Card>
					<CardContent className="space-y-2">
						<p className="text-sm font-medium">Activity</p>
						<p className="text-xs text-muted-foreground">
							{mailboxCount} {mailboxCount === 1 ? "mailbox" : "mailboxes"} ·{" "}
							{lastInboundAt
								? `last mail received ${relativeTime(lastInboundAt)} ago`
								: "no mail received yet"}
						</p>
						<Link href="/inbox" className={buttonVariants({ variant: "outline", size: "sm" })}>
							<Mail /> Open inbox
						</Link>
					</CardContent>
				</Card>
			</div>

			<Dialog open={confirmReceiving} onOpenChange={setConfirmReceiving}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Route incoming mail to this inbox?</DialogTitle>
						<DialogDescription>
							{health?.receiving === "elsewhere"
								? `The zone's catch-all currently sends mail to ${health.receivingTarget ?? "another destination"}. It will be replaced, and that mail will arrive here instead.`
								: "Email Routing will be turned on and the catch-all rule will send incoming mail for this domain to this inbox."}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setConfirmReceiving(false)}>
							Cancel
						</Button>
						<Button disabled={enabling} onClick={() => void turnOnReceiving()}>
							{enabling && <Spinner />}
							Turn on receiving
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

// ── DNS records ───────────────────────────────────────────────────────────────

function DnsRecords({ domainId, active, onChanged }: { domainId: string; active: boolean; onChanged: () => void }) {
	const [records, setRecords] = useState<RecordCheck[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [fixing, setFixing] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setRecords((await getDomainRecordsAction(domainId)).records);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Could not read the records from Cloudflare.");
		} finally {
			setLoading(false);
		}
	}, [domainId]);

	// Checked when the tab is first opened, not on every page view.
	useEffect(() => {
		if (active && records === null && !loading && !error) void load();
	}, [active, records, loading, error, load]);

	async function fix() {
		setFixing(true);
		try {
			const result = await fixDomainRecordsAction(domainId);
			setRecords(result.records);
			toast.success(result.fixed ? `Added ${result.fixed} missing records` : "Nothing was missing");
			onChanged();
		} catch (err: unknown) {
			toast.error(err instanceof Error ? err.message : "Could not add the records");
		} finally {
			setFixing(false);
		}
	}

	const missing = records?.filter((r) => r.status === "missing").length ?? 0;
	const wrong = records?.filter((r) => r.status === "wrong").length ?? 0;

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-sm text-muted-foreground">
					Each record Cloudflare expects for sending, compared with what is in the zone right now.
				</p>
				<div className="flex gap-2">
					<Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
						<RefreshCw className={loading ? "animate-spin" : ""} /> Check now
					</Button>
					{missing > 0 && (
						<Button size="sm" disabled={fixing} onClick={() => void fix()}>
							{fixing ? <Spinner /> : <Plus />} Add {missing} missing
						</Button>
					)}
				</div>
			</div>

			{error && (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}
			{wrong > 0 && (
				<Alert variant="warning">
					<AlertTriangle />
					<AlertDescription>
						{wrong} {wrong === 1 ? "record exists" : "records exist"} with a different value. They are not
						overwritten automatically, because that could break mail you set up on purpose. Compare them
						below and edit them in Cloudflare DNS.
					</AlertDescription>
				</Alert>
			)}

			{records === null && !error ? (
				<div className="space-y-2">
					{[0, 1, 2].map((i) => (
						<Skeleton key={i} className="h-16 rounded-lg" />
					))}
				</div>
			) : (
				<ul className="space-y-2">
					{records?.map((record) => {
						const badge = RECORD_BADGE[record.status];
						return (
							<li
								key={`${record.type}:${record.name}`}
								className="space-y-2 rounded-lg border p-3 text-xs"
							>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Badge variant="soft" className="font-mono">
											{record.type}
										</Badge>
										<Badge variant={badge.variant}>{badge.label}</Badge>
									</div>
									<div className="flex gap-1">
										<Button size="xs" variant="ghost" onClick={() => copyText(record.name, "Name")}>
											<Copy /> Name
										</Button>
										<Button
											size="xs"
											variant="ghost"
											onClick={() => copyText(record.content, "Value")}
										>
											<Copy /> Value
										</Button>
									</div>
								</div>
								<p className="font-mono break-all">{record.name}</p>
								<p className="font-mono break-all text-muted-foreground">{record.content}</p>
								{record.status === "wrong" && record.actual && (
									<p className="font-mono break-all text-warning-muted-foreground">
										In the zone now: {record.actual}
									</p>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

// ── Mailboxes ─────────────────────────────────────────────────────────────────

function Mailboxes({
	domainName,
	mailboxes,
	receiving,
	onChanged,
}: {
	domainName: string;
	mailboxes: DomainDetailData["mailboxes"];
	receiving: DomainHealth["receiving"] | undefined;
	onChanged: () => void;
}) {
	const hosts = mailboxDomains(domainName);
	// Incoming mail is routed per zone, so the shortest name is where mailboxes normally live.
	const [host, setHost] = useState(hosts[hosts.length - 1]);
	const [local, setLocal] = useState("");
	const [adding, setAdding] = useState<string | null>(null);
	const existing = new Set(mailboxes.map((m) => m.email.toLowerCase()));

	async function add(localPart: string) {
		const clean = localPart.trim().toLowerCase();
		if (!clean) return;
		const email = `${clean}@${host}`;
		setAdding(clean);
		try {
			const created = await createInboxAction({
				email,
				display_name: clean.charAt(0).toUpperCase() + clean.slice(1),
				mode: "thread",
			});
			if (created.routing.configured) toast.success(`${email} added`);
			else
				toast.warning(
					`${email} added, but routing needs attention: ${created.routing.error ?? "unknown error"}`,
				);
			setLocal("");
			onChanged();
		} catch (err: unknown) {
			toast.error(err instanceof Error ? err.message : "Could not add the mailbox");
		} finally {
			setAdding(null);
		}
	}

	return (
		<div className="space-y-4">
			{receiving && receiving !== "ready" && receiving !== "unknown" && (
				<Alert variant="warning">
					<AlertTriangle />
					<AlertDescription>
						Mailboxes can be created, but they will not receive mail until receiving is turned on. Use the
						checklist on the Overview tab.
					</AlertDescription>
				</Alert>
			)}

			<Card>
				<CardContent className="space-y-3">
					<p className="text-sm font-medium">Add a mailbox</p>
					<div className="flex flex-wrap gap-2">
						{SUGGESTED_MAILBOXES.filter((name) => !existing.has(`${name}@${host}`)).map((name) => (
							<Button
								key={name}
								size="sm"
								variant="outline"
								disabled={!!adding}
								onClick={() => void add(name)}
							>
								{adding === name ? <Spinner /> : <Plus />}
								{name}@
							</Button>
						))}
					</div>
					<form
						className="flex flex-wrap items-end gap-2"
						onSubmit={(e) => {
							e.preventDefault();
							void add(local);
						}}
					>
						<div className="space-y-1.5">
							<Label htmlFor="mailbox-local">Custom address</Label>
							<div className="flex items-center gap-1.5">
								<Input
									id="mailbox-local"
									value={local}
									onChange={(e) =>
										setLocal(e.target.value.toLowerCase().replace(/[^a-z0-9._+-]/g, ""))
									}
									placeholder="name"
									className="w-36 font-mono text-xs"
								/>
								<span className="text-xs text-muted-foreground">@</span>
								{hosts.length > 1 ? (
									<Select
										items={hosts.map((h) => ({ value: h, label: h }))}
										value={host}
										onValueChange={(v) => v && setHost(v as string)}
									>
										<SelectTrigger
											size="sm"
											className="font-mono text-xs"
											aria-label="Mailbox domain"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{hosts.map((h) => (
												<SelectItem key={h} value={h}>
													{h}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								) : (
									<span className="font-mono text-xs">{host}</span>
								)}
							</div>
						</div>
						<Button type="submit" size="sm" disabled={!local || !!adding}>
							Add
						</Button>
					</form>
				</CardContent>
			</Card>

			{mailboxes.length === 0 ? (
				<p className="text-sm text-muted-foreground">No mailboxes on this domain yet.</p>
			) : (
				<ul className="divide-y rounded-lg border">
					{mailboxes.map((mailbox) => (
						<li key={mailbox.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
							<div className="min-w-0">
								<p className="font-mono text-sm">{mailbox.email}</p>
								<p className="text-2xs text-muted-foreground">{mailbox.display_name}</p>
							</div>
							<div className="flex items-center gap-2">
								{mailbox.routing.configured ? (
									<Badge variant="success">Routed</Badge>
								) : (
									<Badge variant="warning" title={mailbox.routing.error}>
										Routing needs attention
									</Badge>
								)}
								<Link
									href="/inbox/settings"
									className={buttonVariants({ variant: "ghost", size: "sm" })}
								>
									Members
								</Link>
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

// ── Settings ──────────────────────────────────────────────────────────────────

function Settings({
	domainId,
	domainName,
	mailboxCount,
	zoneSiblings,
	onRemoved,
}: {
	domainId: string;
	domainName: string;
	mailboxCount: number;
	zoneSiblings: number;
	onRemoved: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [deleteSending, setDeleteSending] = useState(false);
	const [stopRouting, setStopRouting] = useState(false);
	const [removing, setRemoving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function remove() {
		setRemoving(true);
		setError(null);
		try {
			const result = await removeDomainAction(domainId, { deleteSending, stopRouting });
			if (!result.ok) return setError(result.error);
			toast.success(result.cleaned.length ? result.cleaned.join(". ") : `${domainName} removed from EmailFlare`);
			onRemoved();
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Could not remove the domain");
		} finally {
			setRemoving(false);
		}
	}

	return (
		<Card>
			<CardContent className="space-y-3">
				<div>
					<p className="text-sm font-medium">Remove domain</p>
					<p className="text-xs text-muted-foreground">
						Takes {domainName} out of EmailFlare. API keys limited to it can no longer send.
						{mailboxCount > 0 &&
							` Its ${mailboxCount} ${mailboxCount === 1 ? "mailbox stays" : "mailboxes stay"} and keep their mail.`}
					</p>
				</div>
				<Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
					<Trash2 /> Remove domain
				</Button>

				<Dialog open={open} onOpenChange={(next) => !removing && setOpen(next)}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Remove {domainName}?</DialogTitle>
							<DialogDescription>
								By default only EmailFlare forgets the domain, and everything in Cloudflare stays.
								Choose what else to clean up.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-3">
							<div className="flex items-start gap-2.5">
								<Checkbox
									id="remove-sending"
									checked={deleteSending}
									onCheckedChange={(checked) => setDeleteSending(checked === true)}
									className="mt-0.5"
								/>
								<Label htmlFor="remove-sending" className="block text-sm font-normal">
									Delete the sending domain in Cloudflare
									<span className="block text-2xs text-muted-foreground">
										Disables sending from {domainName} and removes the DNS records Cloudflare
										created for it.
									</span>
								</Label>
							</div>
							<div className="flex items-start gap-2.5">
								<Checkbox
									id="remove-routing"
									checked={stopRouting}
									disabled={zoneSiblings > 0}
									onCheckedChange={(checked) => setStopRouting(checked === true)}
									className="mt-0.5"
								/>
								<Label htmlFor="remove-routing" className="block text-sm font-normal">
									Stop routing incoming mail to this inbox
									<span className="block text-2xs text-muted-foreground">
										{zoneSiblings > 0
											? "Unavailable: another domain in this zone shares the mail routing."
											: "Disables the zone's catch-all rule. Mail sent to this domain will no longer be delivered here."}
									</span>
								</Label>
							</div>
							{error && (
								<Alert variant="destructive">
									<AlertDescription>{error}</AlertDescription>
								</Alert>
							)}
						</div>
						<DialogFooter>
							<Button variant="ghost" disabled={removing} onClick={() => setOpen(false)}>
								Cancel
							</Button>
							<Button variant="destructive" disabled={removing} onClick={() => void remove()}>
								{removing && <Spinner />}
								Remove domain
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</CardContent>
		</Card>
	);
}
