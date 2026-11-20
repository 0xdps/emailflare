"use client";

import React, { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, ListOrdered, GripVertical, X } from "lucide-react";
import { getSequences, Sequence, SequenceStep } from "@/lib/api";
import { createSequenceAction, updateSequenceAction, deleteSequenceAction } from "@/app/actions/sequences";
import { PageHeader, PageShell } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import OwnerAccessBanner from "@/components/OwnerAccessBanner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/lib/UserContext";

const DELAY_AFTER_ITEMS = [
	{ value: "enrollment", label: "Enrollment" },
	{ value: "previous", label: "Previous step" },
];

// ── Step editor ───────────────────────────────────────────────────────────────

function StepRow({
	step,
	index,
	onChange,
	onRemove,
}: {
	step: SequenceStep;
	index: number;
	onChange: (s: SequenceStep) => void;
	onRemove: () => void;
}) {
	return (
		<div className="relative flex items-start gap-2 rounded-lg border-l-2 border-primary/30 bg-muted/40 p-3 pl-4">
			<GripVertical className="mt-2.5 size-3.5 shrink-0 text-muted-foreground/40" />
			<div className="flex-1 flex flex-col gap-2">
				<div className="flex items-center gap-2">
					<Badge variant="outline" className="h-4 shrink-0 text-2xs">
						Step {index + 1}
					</Badge>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label className="text-xs">Template slug</Label>
					<Input
						placeholder="e.g. welcome-email"
						value={step.templateSlug}
						onChange={(e) => onChange({ ...step, templateSlug: e.target.value })}
						className="h-7 font-mono text-sm"
					/>
				</div>
				<div className="flex gap-2">
					<div className="flex flex-col gap-1.5 flex-1">
						<Label className="text-xs">Delay (days)</Label>
						<Input
							type="number"
							min={0}
							value={step.delayDays}
							onChange={(e) => onChange({ ...step, delayDays: parseInt(e.target.value) || 0 })}
							className="h-7 text-sm"
						/>
					</div>
					<div className="flex flex-col gap-1.5 flex-1">
						<Label className="text-xs">After</Label>
						<Select
							items={DELAY_AFTER_ITEMS}
							value={step.delayAfter}
							onValueChange={(v) =>
								v && onChange({ ...step, delayAfter: v as SequenceStep["delayAfter"] })
							}
						>
							<SelectTrigger className="h-7 text-sm">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DELAY_AFTER_ITEMS.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>
			<Button
				variant="ghost"
				size="icon-xs"
				onClick={onRemove}
				aria-label="Remove step"
				className="mt-1 text-muted-foreground hover:text-destructive"
			>
				<X />
			</Button>
		</div>
	);
}

// ── Sequence card ─────────────────────────────────────────────────────────────

function SequenceCard({
	seq,
	isAdmin,
	onEdit,
	onDelete,
}: {
	seq: Sequence;
	isAdmin?: boolean;
	onEdit: () => void;
	onDelete: () => void;
}) {
	return (
		<Card className="gap-3 p-5">
			<div className="flex items-start justify-between gap-2">
				<div>
					<p className="text-sm font-semibold text-foreground">{seq.name}</p>
					<p className="mt-0.5 text-xs text-muted-foreground">
						{seq.steps.length} step{seq.steps.length !== 1 ? "s" : ""}
					</p>
				</div>
				{isAdmin && (
					<div className="flex gap-1.5">
						<Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label="Edit sequence">
							<Pencil />
						</Button>
						<Button
							size="icon-sm"
							variant="ghost"
							onClick={onDelete}
							aria-label="Delete sequence"
							className="hover:text-destructive"
						>
							<Trash2 />
						</Button>
					</div>
				)}
			</div>

			{seq.steps.length > 0 && (
				<div className="flex flex-col gap-1">
					{seq.steps.map((step, i) => (
						<div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
							<span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold">
								{i + 1}
							</span>
							<span className="font-mono">{step.templateSlug}</span>
							<span className="text-muted-foreground/50">·</span>
							<span>
								{step.delayDays === 0
									? "Immediately"
									: `+${step.delayDays}d after ${step.delayAfter === "enrollment" ? "enrollment" : "prev"}`}
							</span>
						</div>
					))}
				</div>
			)}

			<p className="text-2xs text-muted-foreground">Created {new Date(seq.created_at).toLocaleDateString()}</p>
		</Card>
	);
}

// ── Main page ─────────────────────────────────────────────────────────────────

const emptyStep = (): SequenceStep => ({ templateSlug: "", delayDays: 0, delayAfter: "enrollment" });

export default function Sequences({ initialSequences }: { initialSequences?: Sequence[] }) {
	const { isAdmin } = usePermissions();
	const [sequences, setSequences] = useState<Sequence[]>(initialSequences ?? []);
	const [loading, setLoading] = useState(initialSequences === undefined);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [editing, setEditing] = useState<Sequence | null>(null);
	const [name, setName] = useState("");
	const [steps, setSteps] = useState<SequenceStep[]>([emptyStep()]);
	const [saving, setSaving] = useState(false);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);

	useEffect(() => {
		if (initialSequences === undefined) {
			getSequences()
				.then(setSequences)
				.finally(() => setLoading(false));
		}
	}, [initialSequences]);

	function openCreate() {
		setEditing(null);
		setName("");
		setSteps([emptyStep()]);
		setSheetOpen(true);
	}

	function openEdit(seq: Sequence) {
		setEditing(seq);
		setName(seq.name);
		setSteps(seq.steps.length > 0 ? [...seq.steps] : [emptyStep()]);
		setSheetOpen(true);
	}

	async function handleSave() {
		if (!name.trim()) return;
		setSaving(true);
		try {
			const validSteps = steps.filter((s) => s.templateSlug.trim());
			if (editing) {
				const res = await updateSequenceAction(editing.id, { name: name.trim(), steps: validSteps });
				if (!res.error) {
					setSequences((prev) =>
						prev.map((s) => (s.id === editing.id ? { ...s, name: name.trim(), steps: validSteps } : s)),
					);
				}
			} else {
				const res = await createSequenceAction({ name: name.trim(), steps: validSteps });
				if (res.data) {
					setSequences((prev) => [...prev, res.data as any]);
				}
			}
			setSheetOpen(false);
		} finally {
			setSaving(false);
		}
	}

	async function handleDelete() {
		if (!deleteId) return;
		setDeleting(true);
		try {
			const res = await deleteSequenceAction(deleteId);
			if (!res.error) {
				setSequences((prev) => prev.filter((s) => s.id !== deleteId));
			}
			setDeleteId(null);
		} finally {
			setDeleting(false);
		}
	}

	function updateStep(i: number, s: SequenceStep) {
		setSteps((prev) => prev.map((old, idx) => (idx === i ? s : old)));
	}

	return (
		<div className="flex h-full flex-col">
			<OwnerAccessBanner />
			<PageShell className="mx-0">
				<PageHeader
					title="Sequences"
					description="Automate multi-step email campaigns"
					actions={
						isAdmin && (
							<Button onClick={openCreate}>
								<Plus />
								New sequence
							</Button>
						)
					}
				/>

				{loading ? (
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{[...Array(3)].map((_, i) => (
							<Skeleton key={i} className="h-32 rounded-xl" />
						))}
					</div>
				) : sequences.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<ListOrdered />
							</EmptyMedia>
							<EmptyTitle>No sequences yet</EmptyTitle>
						</EmptyHeader>
						{isAdmin && (
							<EmptyContent>
								<Button variant="outline" onClick={openCreate}>
									Create your first sequence
								</Button>
							</EmptyContent>
						)}
					</Empty>
				) : (
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{sequences.map((seq) => (
							<SequenceCard
								key={seq.id}
								seq={seq}
								isAdmin={isAdmin}
								onEdit={() => openEdit(seq)}
								onDelete={() => setDeleteId(seq.id)}
							/>
						))}
					</div>
				)}

				{/* Create / Edit Sheet */}
				<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
					<SheetContent className="w-120 overflow-y-auto sm:max-w-120">
						<SheetHeader>
							<SheetTitle>{editing ? "Edit sequence" : "New sequence"}</SheetTitle>
						</SheetHeader>

						<div className="flex flex-col gap-5 py-5">
							<div className="flex flex-col gap-1.5">
								<Label>Name</Label>
								<Input
									placeholder="e.g. Onboarding flow"
									value={name}
									onChange={(e) => setName(e.target.value)}
									autoFocus
								/>
							</div>

							<Separator />

							<div className="flex flex-col gap-3">
								<div className="flex items-center justify-between">
									<Label>Steps</Label>
									<Button
										size="sm"
										variant="outline"
										onClick={() => setSteps((prev) => [...prev, emptyStep()])}
									>
										<Plus />
										Add step
									</Button>
								</div>

								{steps.length === 0 && (
									<p className="text-sm text-muted-foreground text-center py-4">
										No steps — click "Add step" to begin
									</p>
								)}

								<div className="flex flex-col gap-2">
									{steps.map((step, i) => (
										<StepRow
											key={i}
											step={step}
											index={i}
											onChange={(s) => updateStep(i, s)}
											onRemove={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
										/>
									))}
								</div>
							</div>
						</div>

						<SheetFooter>
							<Button variant="outline" onClick={() => setSheetOpen(false)}>
								Cancel
							</Button>
							<Button onClick={handleSave} disabled={saving || !name.trim()}>
								{saving && <Spinner />}
								{saving ? "Saving…" : editing ? "Save changes" : "Create"}
							</Button>
						</SheetFooter>
					</SheetContent>
				</Sheet>

				{/* Delete confirm */}
				<Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Delete sequence?</DialogTitle>
							<DialogDescription>
								This will also cancel all active enrollments. This action cannot be undone.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button variant="outline" onClick={() => setDeleteId(null)}>
								Cancel
							</Button>
							<Button variant="destructive" onClick={handleDelete} disabled={deleting}>
								{deleting && <Spinner />}
								Delete
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</PageShell>
		</div>
	);
}
