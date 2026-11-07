"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ShieldOff, Search, X, Trash2, Plus, ChevronLeft, ChevronRight, MailX } from "lucide-react";
import api from "@/lib/api";
import { createSuppressionAction, deleteSuppressionAction } from "@/app/actions/suppressions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { cn } from "@/lib/utils";

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

const REASON_CLASS: Record<SuppressionReason, string> = {
	hard_bounce: "bg-destructive/10 text-destructive border-destructive/20",
	soft_bounce: "bg-amber-500/10 text-amber-600 border-amber-200",
	complaint: "bg-orange-500/10 text-orange-600 border-orange-200",
	manual: "bg-muted text-muted-foreground border-border",
	unsubscribed: "bg-blue-500/10 text-blue-600 border-blue-200",
};

const REASON_FILTER_OPTS = [
	{ label: "All reasons", value: "" },
	{ label: "Hard bounce", value: "hard_bounce" },
	{ label: "Soft bounce", value: "soft_bounce" },
	{ label: "Complaint", value: "complaint" },
	{ label: "Manual", value: "manual" },
	{ label: "Unsubscribed", value: "unsubscribed" },
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
					<DialogTitle className="text-base font-semibold">Suppress Recipient Address</DialogTitle>
					<DialogDescription className="text-xs">
						Prevent EmailFlare from sending emails to this counterparty across all domains.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4 pt-2">
					{err && <p className="text-xs text-destructive">{err}</p>}

					<div className="space-y-1.5">
						<Label className="text-xs">Email Address</Label>
						<Input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="recipient@example.com"
							required
							className="h-8.5 text-xs font-mono"
						/>
					</div>

					<div className="space-y-1.5">
						<Label className="text-xs">Suppression Reason</Label>
						<Select value={reason} onValueChange={(v) => setReason(v as SuppressionReason)}>
							<SelectTrigger className="h-8.5 text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="manual" className="text-xs">
									Manual Suppression
								</SelectItem>
								<SelectItem value="hard_bounce" className="text-xs">
									Hard Bounce
								</SelectItem>
								<SelectItem value="complaint" className="text-xs">
									Spam Complaint
								</SelectItem>
								<SelectItem value="unsubscribed" className="text-xs">
									Unsubscribed
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<DialogFooter className="pt-2">
						<Button type="button" variant="ghost" onClick={onClose} className="h-8 text-xs">
							Cancel
						</Button>
						<Button type="submit" disabled={saving || !email} className="h-8 text-xs">
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
	const isFirstMount = useRef(true);

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
		<div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<div className="flex items-center gap-2 mb-1">
						<ShieldOff size={14} className="text-orange-500" />
						<span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
							Deliverability & Reputation
						</span>
					</div>
					<h1 className="text-2xl font-bold tracking-tight text-foreground">Suppressions</h1>
					<p className="text-xs text-muted-foreground mt-0.5">
						Addresses blocked from receiving emails due to bounces, spam complaints, or unsubscribes.
					</p>
				</div>
				<Button size="sm" className="gap-1.5 h-8.5 text-xs shadow-xs" onClick={() => setAddOpen(true)}>
					<Plus size={13} />
					<span>Add Suppression</span>
				</Button>
			</div>

			{/* Filter & Search Bar */}
			<div className="flex items-center gap-3">
				<form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-sm">
					<div className="relative flex-1">
						<Search
							size={12}
							className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
						/>
						<Input
							value={searchInput}
							onChange={(e) => setSearchInput(e.target.value)}
							placeholder="Search suppressed emails..."
							className="pl-7 h-8.5 text-xs bg-muted/30"
						/>
					</div>
					{search && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-8"
							onClick={() => {
								setSearch("");
								setSearchInput("");
								setPage(1);
							}}
						>
							<X size={12} />
						</Button>
					)}
				</form>

				<Select
					value={reason}
					onValueChange={(v) => {
						setReason(v ?? "");
						setPage(1);
					}}
				>
					<SelectTrigger className="h-8.5 text-xs w-40">
						<SelectValue placeholder="All reasons" />
					</SelectTrigger>
					<SelectContent>
						{REASON_FILTER_OPTS.map((o) => (
							<SelectItem key={o.value} value={o.value} className="text-xs">
								{o.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Suppressions Table Card */}
			<div className="rounded-xl border border-border bg-card overflow-hidden">
				<div className="px-5 py-3.5 border-b border-border bg-muted/20 flex items-center justify-between">
					<span className="text-xs font-semibold text-foreground">
						Suppressed Recipients ({result?.total ?? 0})
					</span>
					<span className="text-[11px] text-muted-foreground">Automatically checked before send</span>
				</div>

				{loading ? (
					<div className="p-4 space-y-2">
						{[...Array(5)].map((_, i) => (
							<Skeleton key={i} className="h-12 rounded-lg" />
						))}
					</div>
				) : !result || result.data.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
						<MailX size={32} strokeWidth={1.25} className="opacity-30 mb-1" />
						<p className="text-xs font-semibold text-foreground">No suppressions recorded</p>
						<p className="text-[11px]">Any bounced or unsubscribed recipients will be listed here.</p>
					</div>
				) : (
					<table className="w-full text-xs">
						<thead>
							<tr className="border-b border-border bg-muted/10 text-muted-foreground">
								<th className="px-5 py-3 text-left font-semibold uppercase tracking-wider text-[11px]">
									Email Address
								</th>
								<th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[11px]">
									Reason
								</th>
								<th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[11px]">
									Date Suppressed
								</th>
								<th className="px-5 py-3 text-right font-semibold uppercase tracking-wider text-[11px]">
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{result.data.map((row) => (
								<tr key={row.id} className="hover:bg-muted/30 transition-colors">
									<td className="px-5 py-3 font-mono text-xs font-medium text-foreground select-all">
										{row.email}
									</td>
									<td className="px-4 py-3">
										<Badge
											variant="outline"
											className={`text-[10px] px-2 py-0.5 font-medium ${REASON_CLASS[row.reason]}`}
										>
											{REASON_LABEL[row.reason]}
										</Badge>
									</td>
									<td className="px-4 py-3 text-muted-foreground tabular-nums">
										{new Date(row.created_at).toLocaleDateString("en-US", {
											year: "numeric",
											month: "short",
											day: "numeric",
										})}
									</td>
									<td className="px-5 py-3 text-right">
										<Button
											variant="ghost"
											size="sm"
											className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
											disabled={deleting === row.id}
											onClick={() => handleDelete(row.id)}
										>
											<Trash2 size={12} className="mr-1" />
											<span>Unsuppress</span>
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}

				{/* Pagination */}
				{result && result.pages > 1 && (
					<div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-background">
						<span>
							{result.total} total · Page {result.page} of {result.pages}
						</span>
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								disabled={page <= 1}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
							>
								<ChevronLeft size={13} />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								disabled={page >= result.pages}
								onClick={() => setPage((p) => Math.min(result.pages, p + 1))}
							>
								<ChevronRight size={13} />
							</Button>
						</div>
					</div>
				)}
			</div>

			<AddDialog open={addOpen} onClose={() => setAddOpen(false)} onAdded={load} />
		</div>
	);
}
