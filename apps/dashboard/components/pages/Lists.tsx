"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ListFilter } from "lucide-react";
import api from "@/lib/api";
import { createListAction, deleteListAction } from "@/app/actions/lists";
import { PageHeader, PageShell } from "@/components/app/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
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
		<PageShell>
			{/* Create Dialog */}
			<Dialog open={creating} onOpenChange={(open) => !open && setCreating(false)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>New Unsubscribe List</DialogTitle>
						<DialogDescription>
							Recipients unsubscribing from this list will be issued an RFC 8058 one-click token.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleCreate} className="space-y-4 pt-2">
						{err && (
							<Alert variant="destructive">
								<AlertDescription className="text-destructive">{err}</AlertDescription>
							</Alert>
						)}

						<div className="space-y-1.5">
							<Label>List Name</Label>
							<Input
								value={form.name}
								onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
								required
								placeholder="e.g. Weekly Newsletter, Product Updates"
							/>
						</div>

						<div className="space-y-1.5">
							<Label>Description (optional)</Label>
							<Input
								value={form.description}
								onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
								placeholder="e.g. Marketing campaigns and product announcements"
							/>
						</div>

						<DialogFooter className="pt-2">
							<Button type="button" variant="ghost" onClick={() => setCreating(false)}>
								Cancel
							</Button>
							<Button type="submit" disabled={saving || !form.name}>
								{saving ? "Creating..." : "Create List"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<PageHeader
				eyebrow="Compliance & Opt-out"
				title="Unsubscribe Lists"
				description="Attach RFC 8058 one-click unsubscribe headers to transactional or sequence sends."
				actions={
					<Button onClick={() => setCreating(true)}>
						<Plus />
						<span>New List</span>
					</Button>
				}
			/>

			{/* Lists Card */}
			<Card className="gap-0 py-0">
				<div className="flex items-center justify-between border-b border-border bg-muted/20 px-5 py-3.5">
					<span className="text-xs font-semibold text-foreground">Active Lists ({lists.length})</span>
					<span className="text-2xs text-muted-foreground">List-Unsubscribe: One-Click</span>
				</div>

				{loading ? (
					<div className="space-y-2 p-4">
						{[...Array(3)].map((_, i) => (
							<Skeleton key={i} className="h-14 rounded-lg" />
						))}
					</div>
				) : lists.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<ListFilter />
							</EmptyMedia>
							<EmptyTitle>No unsubscribe lists configured</EmptyTitle>
							<EmptyDescription>
								Create a list to attach RFC 8058 one-click headers to campaigns and sequences.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<div className="divide-y divide-border">
						{lists.map((l) => (
							<div
								key={l.id}
								className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30 md:px-5"
							>
								<div className="min-w-0 flex-1 space-y-1">
									<div className="flex items-center gap-2">
										<span className="text-xs font-semibold text-foreground">{l.name}</span>
										{l.slug && (
											<Badge variant="outline" className="font-mono text-2xs">
												{l.slug}
											</Badge>
										)}
									</div>
									{l.description ? (
										<p className="truncate text-xs text-muted-foreground">{l.description}</p>
									) : (
										<p className="font-mono text-2xs text-muted-foreground">ID: {l.id}</p>
									)}
								</div>

								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleDelete(l.id)}
									disabled={deleting === l.id}
									className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
								>
									<Trash2 />
									<span>Delete</span>
								</Button>
							</div>
						))}
					</div>
				)}
			</Card>
		</PageShell>
	);
}
