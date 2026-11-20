"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Search, X, Trash2, Plus, ChevronLeft, ChevronRight, MailX } from "lucide-react";
import api from "@/lib/api";
import { createSuppressionAction, deleteSuppressionAction } from "@/app/actions/suppressions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PageShell } from "@/components/app/PageHeader";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export type SuppressionReason = "hard_bounce" | "soft_bounce" | "complaint" | "manual" | "unsubscribed";

export interface SuppressionRow {
	id: string;
	email: string;
	reason: SuppressionReason;
	domain_id: string | null;
	email_log_id: string | null;
	list_id: string | null;
	created_at: string;
}

export interface PagedSuppressions {
	data: SuppressionRow[];
	total: number;
	page: number;
	limit: number;
	pages: number;
}

const REASON_LABEL: Record<SuppressionReason, string> = {
	hard_bounce: "Hard bounce",
	soft_bounce: "Soft bounce",
	complaint: "Complaint",
	manual: "Manual",
	unsubscribed: "Unsubscribed",
};

const REASON_VARIANT: Record<SuppressionReason, "destructive" | "warning" | "secondary" | "info"> = {
	hard_bounce: "destructive",
	soft_bounce: "warning",
	complaint: "destructive",
	manual: "secondary",
	unsubscribed: "info",
};

const REASON_FILTER_OPTS = [
	{ label: "All reasons", value: "" },
	{ label: "Hard bounce", value: "hard_bounce" },
	{ label: "Soft bounce", value: "soft_bounce" },
	{ label: "Complaint", value: "complaint" },
	{ label: "Manual", value: "manual" },
	{ label: "Unsubscribed", value: "unsubscribed" },
];

const ADD_REASON_ITEMS = [
	{ value: "manual", label: "Manual Suppression" },
	{ value: "hard_bounce", label: "Hard Bounce" },
	{ value: "complaint", label: "Spam Complaint" },
	{ value: "unsubscribed", label: "Unsubscribed" },
];

// ─── Add dialog ───────────────────────────────────────────────────────────────

function AddDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
	const [email, setEmail] = useState("");
	const [reason, setReason] = useState<SuppressionReason>("manual");
	const [saving, setSaving] = useState(false);
	const [err, setErr] = useState("");

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setErr("");
		setSaving(true);
		try {
			const res = await createSuppressionAction({ email: email.toLowerCase().trim(), reason });
			if (res.error) {
				setErr(res.error);
				return;
			}
			onAdded();
			onClose();
			setEmail("");
			setReason("manual");
		} catch (error: unknown) {
			const msg = (error as { message?: string })?.message;
			setErr(msg ?? "Failed to add suppression");
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v) onClose();
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Suppress Recipient Address</DialogTitle>
					<DialogDescription>
						Prevent EmailFlare from sending emails to this counterparty across all domains.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4 pt-2">
					{err && (
						<Alert variant="destructive">
							<AlertDescription>{err}</AlertDescription>
						</Alert>
					)}

					<div className="space-y-1.5">
						<Label>Email Address</Label>
						<Input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="recipient@example.com"
							required
							className="font-mono text-sm"
						/>
					</div>

					<div className="space-y-1.5">
						<Label>Suppression Reason</Label>
						<Select
							items={ADD_REASON_ITEMS}
							value={reason}
							onValueChange={(v) => setReason(v as SuppressionReason)}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ADD_REASON_ITEMS.map((o) => (
									<SelectItem key={o.value} value={o.value}>
										{o.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<DialogFooter className="pt-2">
						<Button type="button" variant="ghost" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit" disabled={saving || !email}>
							{saving ? "Saving..." : "Add to Suppressions"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function SuppressionsPage({ initialResult }: { initialResult?: PagedSuppressions } = {}) {
	const [result, setResult] = useState<PagedSuppressions | null>(initialResult ?? null);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [searchInput, setSearchInput] = useState("");
	const [reason, setReason] = useState("");
	const [loading, setLoading] = useState(initialResult === undefined);
	const [addOpen, setAddOpen] = useState(false);
	const [deleting, setDeleting] = useState<string | null>(null);
	const [confirmId, setConfirmId] = useState<string | null>(null);
	const [importing, setImporting] = useState(false);
	const isFirstMount = useRef(true);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const load = useCallback(async () => {
		setLoading(true);
		const params = new URLSearchParams({ page: String(page), limit: "50" });
		if (search) params.set("search", search);
		if (reason) params.set("reason", reason);
		try {
			const { data } = await api.get<PagedSuppressions>(`/api/suppressions?${params}`);
			setResult(data);
		} catch {
			setResult(null);
		} finally {
			setLoading(false);
		}
	}, [page, search, reason]);

	useEffect(() => {
		if (isFirstMount.current) {
			isFirstMount.current = false;
			if (initialResult) return;
		}
		load();
	}, [load, initialResult]);

	function handleSearch(e: React.FormEvent) {
		e.preventDefault();
		setSearch(searchInput);
		setPage(1);
	}

	async function handleDelete(id: string) {
		setDeleting(id);
		try {
			await deleteSuppressionAction(id);
			load();
		} finally {
			setDeleting(null);
		}
	}

	return (
		<PageShell>
			<PageHeader
				eyebrow="Deliverability & Reputation"
				title="Suppressions"
				description="Addresses blocked from receiving emails due to bounces, spam complaints, or unsubscribes."
				actions={
					<>
						<Button
							variant="outline"
							onClick={() => {
								window.location.href = "/api/suppressions/export.csv";
							}}
						>
							Export CSV
						</Button>
						<Button variant="outline" disabled={importing} onClick={() => fileInputRef.current?.click()}>
							{importing ? "Importing…" : "Import CSV"}
						</Button>
						<Input
							ref={fileInputRef}
							type="file"
							accept=".csv,text/csv"
							className="sr-only"
							onChange={async (e) => {
								const file = e.target.files?.[0];
								if (!file) return;
								setImporting(true);
								try {
									await api.post("/api/suppressions/import", await file.text(), {
										headers: { "Content-Type": "text/csv" },
									});
									load();
								} finally {
									setImporting(false);
									e.target.value = "";
								}
							}}
						/>
						<Button onClick={() => setAddOpen(true)}>
							<Plus />
							<span>Add Suppression</span>
						</Button>
					</>
				}
			/>

			{/* Filter & Search Bar */}
			<div className="flex flex-wrap items-center gap-3">
				<form onSubmit={handleSearch} className="flex max-w-sm min-w-0 flex-1 items-center gap-2">
					<InputGroup className="flex-1">
						<InputGroupAddon>
							<Search />
						</InputGroupAddon>
						<InputGroupInput
							value={searchInput}
							onChange={(e) => setSearchInput(e.target.value)}
							placeholder="Search suppressed emails..."
						/>
					</InputGroup>
					{search && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							aria-label="Clear search"
							onClick={() => {
								setSearch("");
								setSearchInput("");
								setPage(1);
							}}
						>
							<X />
						</Button>
					)}
				</form>

				<Select
					items={REASON_FILTER_OPTS}
					value={reason}
					onValueChange={(v) => {
						setReason(v ?? "");
						setPage(1);
					}}
				>
					<SelectTrigger className="w-40">
						<SelectValue placeholder="All reasons" />
					</SelectTrigger>
					<SelectContent>
						{REASON_FILTER_OPTS.map((o) => (
							<SelectItem key={o.value} value={o.value}>
								{o.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Suppressions Table Card */}
			<Card className="gap-0 py-0">
				<div className="flex items-center justify-between border-b border-border bg-muted/20 px-5 py-3.5">
					<span className="text-sm font-semibold text-foreground">
						Suppressed Recipients ({result?.total ?? 0})
					</span>
					<span className="text-2xs text-muted-foreground">Automatically checked before send</span>
				</div>

				{loading ? (
					<div className="space-y-2 p-4">
						{[...Array(5)].map((_, i) => (
							<Skeleton key={i} className="h-12 rounded-lg" />
						))}
					</div>
				) : !result || result.data.length === 0 ? (
					<Empty className="py-16">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<MailX />
							</EmptyMedia>
							<EmptyTitle>No suppressions recorded</EmptyTitle>
							<EmptyDescription>
								Any bounced or unsubscribed recipients will be listed here.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<Table>
						<TableHeader>
							<TableRow className="bg-muted/10 hover:bg-muted/10">
								<TableHead className="px-5 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
									Email Address
								</TableHead>
								<TableHead className="px-4 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
									Reason
								</TableHead>
								<TableHead className="px-4 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
									Date Suppressed
								</TableHead>
								<TableHead className="px-5 text-right text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
									Actions
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{result.data.map((row) => (
								<TableRow key={row.id}>
									<TableCell className="px-5 py-3 font-mono text-xs font-medium text-foreground select-all">
										{row.email}
									</TableCell>
									<TableCell className="px-4 py-3">
										<Badge variant={REASON_VARIANT[row.reason]}>{REASON_LABEL[row.reason]}</Badge>
									</TableCell>
									<TableCell className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
										{new Date(row.created_at).toLocaleDateString("en-US", {
											year: "numeric",
											month: "short",
											day: "numeric",
										})}
									</TableCell>
									<TableCell className="px-5 py-3 text-right">
										<Button
											variant="ghost"
											size="sm"
											className="text-muted-foreground hover:text-destructive"
											disabled={deleting === row.id}
											onClick={() => setConfirmId(row.id)}
										>
											<Trash2 />
											<span>Unsuppress</span>
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}

				{/* Pagination */}
				{result && result.pages > 1 && (
					<div className="flex items-center justify-between border-t border-border bg-background p-3 text-xs text-muted-foreground">
						<span>
							{result.total} total · Page {result.page} of {result.pages}
						</span>
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Previous page"
								disabled={page <= 1}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
							>
								<ChevronLeft />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Next page"
								disabled={page >= result.pages}
								onClick={() => setPage((p) => Math.min(result.pages, p + 1))}
							>
								<ChevronRight />
							</Button>
						</div>
					</div>
				)}
			</Card>

			<AddDialog open={addOpen} onClose={() => setAddOpen(false)} onAdded={load} />
			<Dialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Unsuppress this address?</DialogTitle>
						<DialogDescription>
							Future sends to this address will be delivered again. This does not undo a bounce at the
							recipient.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirmId(null)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							disabled={!confirmId || deleting === confirmId}
							onClick={() => {
								if (!confirmId) return;
								const id = confirmId;
								setConfirmId(null);
								void handleDelete(id);
							}}
						>
							Unsuppress
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</PageShell>
	);
}
