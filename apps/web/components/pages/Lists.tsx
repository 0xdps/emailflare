"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Users, X, ListFilter, ShieldCheck } from "lucide-react";
import api from "@/lib/api";
import { createListAction, deleteListAction } from "@/app/actions/lists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";

export interface List {
	id: string;
	name: string;
	slug: string | null;
	description: string | null;
	domain_id: string | null;
	created_at: string;
}

export default function ListsPage({ initialLists }: { initialLists?: List[] }) {
	const [lists, setLists] = useState<List[]>(initialLists ?? []);
	const [loading, setLoading] = useState(initialLists === undefined);
	const [creating, setCreating] = useState(false);
	const [form, setForm] = useState({ name: "", description: "" });
	const [saving, setSaving] = useState(false);
	const [err, setErr] = useState("");
	const [deleting, setDeleting] = useState<string | null>(null);

	async function load() {
		setLoading(true);
		try {
			const { data } = await api.get<List[]>("/api/lists");
			setLists(data);
		} catch {
			setLists([]);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		if (initialLists === undefined) {
			load();
		}
	}, [initialLists]);

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		setErr("");
		setSaving(true);
		try {
			const res = await createListAction({
				name: form.name,
				description: form.description || undefined,
			});
			if (res.error) {
				setErr(res.error);
				return;
			}
			setForm({ name: "", description: "" });
			setCreating(false);
			load();
		} catch (error: unknown) {
			const msg = (error as { message?: string })?.message;
			setErr(msg ?? "Failed to create list");
		} finally {
			setSaving(false);
		}
	}

	async function handleDelete(id: string) {
		setDeleting(id);
		try {
			const res = await deleteListAction(id);
			if (res.error) {
				setErr(res.error);
				return;
			}
			load();
		} catch (error: unknown) {
			const msg = (error as { message?: string })?.message;
			setErr(msg ?? "Failed to delete list");
		} finally {
			setDeleting(null);
		}
	}

	return (
		<div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
			{/* Create Dialog */}
			<Dialog open={creating} onOpenChange={(open) => !open && setCreating(false)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="text-base font-semibold">New Unsubscribe List</DialogTitle>
						<DialogDescription className="text-xs">
							Recipients unsubscribing from this list will be issued an RFC 8058 one-click token.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleCreate} className="space-y-4 pt-2">
						{err && <p className="text-xs text-destructive">{err}</p>}

						<div className="space-y-1.5">
							<Label className="text-xs">List Name</Label>
							<Input
								value={form.name}
								onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
								required
								placeholder="e.g. Weekly Newsletter, Product Updates"
								className="h-8.5 text-xs"
							/>
						</div>

						<div className="space-y-1.5">
							<Label className="text-xs">Description (optional)</Label>
							<Input
								value={form.description}
								onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
								placeholder="e.g. Marketing campaigns and product announcements"
								className="h-8.5 text-xs"
							/>
						</div>

						<DialogFooter className="pt-2">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setCreating(false)}
								className="h-8 text-xs"
							>
								Cancel
							</Button>
							<Button type="submit" disabled={saving || !form.name} className="h-8 text-xs">
								{saving ? "Creating..." : "Create List"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div>
					<div className="flex items-center gap-2 mb-1">
						<Users size={14} className="text-orange-500" />
						<span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
							Compliance & Opt-out
						</span>
					</div>
					<h1 className="text-2xl font-bold tracking-tight text-foreground">Unsubscribe Lists</h1>
					<p className="text-xs text-muted-foreground mt-0.5">
						Attach RFC 8058 one-click unsubscribe headers to transactional or sequence sends.
					</p>
				</div>
				<Button onClick={() => setCreating(true)} className="gap-1.5 text-xs h-8.5 shadow-xs">
					<Plus size={13} />
					<span>New List</span>
				</Button>
			</div>

			{/* Lists Card */}
			<div className="rounded-xl border border-border bg-card overflow-hidden">
				<div className="px-5 py-3.5 border-b border-border bg-muted/20 flex items-center justify-between">
					<span className="text-xs font-semibold text-foreground">Active Lists ({lists.length})</span>
					<span className="text-[11px] text-muted-foreground">List-Unsubscribe: One-Click</span>
				</div>

				{loading ? (
					<div className="p-4 space-y-2">
						{[...Array(3)].map((_, i) => (
							<Skeleton key={i} className="h-14 rounded-lg" />
						))}
					</div>
				) : lists.length === 0 ? (
					<div className="text-center py-16 text-muted-foreground space-y-2">
						<ListFilter size={32} strokeWidth={1.25} className="mx-auto opacity-40 mb-1" />
						<p className="text-xs font-semibold text-foreground">No unsubscribe lists configured</p>
						<p className="text-[11px] max-w-sm mx-auto">
							Create a list to attach RFC 8058 one-click headers to campaigns and sequences.
						</p>
					</div>
				) : (
					<div className="divide-y divide-border">
						{lists.map((l) => (
							<div
								key={l.id}
								className="p-4 md:px-5 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
							>
								<div className="space-y-1 min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="text-xs font-semibold text-foreground">{l.name}</span>
										{l.slug && (
											<Badge variant="outline" className="font-mono text-[10px]">
												{l.slug}
											</Badge>
										)}
									</div>
									{l.description ? (
										<p className="text-xs text-muted-foreground truncate">{l.description}</p>
									) : (
										<p className="text-[11px] text-muted-foreground font-mono">ID: {l.id}</p>
									)}
								</div>

								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleDelete(l.id)}
									disabled={deleting === l.id}
									className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
								>
									<Trash2 size={12} className="mr-1.5" />
									<span>Delete</span>
								</Button>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
