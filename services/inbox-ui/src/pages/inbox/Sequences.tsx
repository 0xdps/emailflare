import React, { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Loader2, ListOrdered, GripVertical, X } from "lucide-react";
import {
	getSequences,
	createSequence,
	updateSequence,
	deleteSequence,
	enrollInSequence,
	Sequence,
	SequenceStep,
} from "../../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import OwnerAccessBanner from "../../components/OwnerAccessBanner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
		<div className="flex items-start gap-2 p-3 bg-muted/40 rounded-lg">
			<GripVertical size={14} className="mt-2.5 text-muted-foreground/40 shrink-0" />
			<div className="flex-1 flex flex-col gap-2">
				<div className="flex items-center gap-2">
					<Badge variant="outline" className="text-[10px] h-4 shrink-0">
						Step {index + 1}
					</Badge>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label className="text-xs">Template slug</Label>
					<Input
						placeholder="e.g. welcome-email"
						value={step.templateSlug}
						onChange={(e) => onChange({ ...step, templateSlug: e.target.value })}
						className="h-7 text-sm font-mono"
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
							value={step.delayAfter}
							onValueChange={(v) => onChange({ ...step, delayAfter: v as SequenceStep["delayAfter"] })}
						>
							<SelectTrigger className="h-7 text-sm">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="enrollment">Enrollment</SelectItem>
								<SelectItem value="previous">Previous step</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>
			<button onClick={onRemove} className="mt-1 text-muted-foreground hover:text-destructive transition-colors">
				<X size={14} />
			</button>
		</div>
	);
}

// ── Sequence card ─────────────────────────────────────────────────────────────

function SequenceCard({ seq, onEdit, onDelete }: { seq: Sequence; onEdit: () => void; onDelete: () => void }) {
	return (
		<div className="bg-card rounded-xl p-5 flex flex-col gap-3 shadow-[0_1px_3px_oklch(0.138_0.012_50/0.08)]">
			<div className="flex items-start justify-between gap-2">
				<div>
					<p className="text-[14px] font-semibold text-foreground">{seq.name}</p>
					<p className="text-[12px] text-muted-foreground mt-0.5">
						{seq.steps.length} step{seq.steps.length !== 1 ? "s" : ""}
					</p>
				</div>
				<div className="flex gap-1.5">
					<Button size="sm" variant="ghost" onClick={onEdit} className="h-7 px-2">
						<Pencil size={13} />
					</Button>
					<Button size="sm" variant="ghost" onClick={onDelete} className="h-7 px-2 hover:text-destructive">
						<Trash2 size={13} />
					</Button>
				</div>
			</div>

			{seq.steps.length > 0 && (
				<div className="flex flex-col gap-1">
					{seq.steps.map((step, i) => (
						<div key={i} className="flex items-center gap-2 text-[12px] text-muted-foreground">
							<span className="size-4 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold shrink-0">
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

			<p className="text-[10.5px] text-muted-foreground/40">
				Created {new Date(seq.created_at).toLocaleDateString()}
			</p>
		</div>
	);
}

// ── Main page ─────────────────────────────────────────────────────────────────

const emptyStep = (): SequenceStep => ({ templateSlug: "", delayDays: 0, delayAfter: "enrollment" });

export default function Sequences() {
	const [sequences, setSequences] = useState<Sequence[]>([]);
	const [loading, setLoading] = useState(true);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [editing, setEditing] = useState<Sequence | null>(null);
	const [name, setName] = useState("");
	const [steps, setSteps] = useState<SequenceStep[]>([emptyStep()]);
	const [saving, setSaving] = useState(false);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);

	useEffect(() => {
		getSequences()
			.then(setSequences)
			.finally(() => setLoading(false));
	}, []);

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
				const updated = await updateSequence(editing.id, { name: name.trim(), steps: validSteps });
				setSequences((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
			} else {
				const created = await createSequence({ name: name.trim(), steps: validSteps });
				setSequences((prev) => [...prev, created]);
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
			await deleteSequence(deleteId);
			setSequences((prev) => prev.filter((s) => s.id !== deleteId));
			setDeleteId(null);
		} finally {
			setDeleting(false);
		}
	}

	function updateStep(i: number, s: SequenceStep) {
		setSteps((prev) => prev.map((old, idx) => (idx === i ? s : old)));
	}

	return (
		<div className="flex flex-col h-full">
			<OwnerAccessBanner />
			<div className="p-6 max-w-4xl">
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<div>
						<h1 className="text-[18px] font-semibold text-foreground tracking-tight">Sequences</h1>
						<p className="text-sm text-muted-foreground mt-0.5">Automate multi-step email campaigns</p>
					</div>
					<Button size="sm" onClick={openCreate}>
						<Plus size={14} />
						New sequence
					</Button>
				</div>

				{loading ? (
					<div className="flex justify-center py-16">
						<Loader2 size={20} className="animate-spin text-muted-foreground" />
					</div>
				) : sequences.length === 0 ? (
					<div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
						<ListOrdered size={36} className="opacity-20" />
						<p className="text-sm">No sequences yet</p>
						<Button size="sm" variant="outline" onClick={openCreate}>
							Create your first sequence
						</Button>
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{sequences.map((seq) => (
							<SequenceCard
								key={seq.id}
								seq={seq}
								onEdit={() => openEdit(seq)}
								onDelete={() => setDeleteId(seq.id)}
							/>
						))}
					</div>
				)}

				{/* Create / Edit Sheet */}
				<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
					<SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
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
										className="h-7 text-xs"
									>
										<Plus size={12} />
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
								{saving && <Loader2 size={13} className="animate-spin" />}
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
						</DialogHeader>
						<p className="text-sm text-muted-foreground">
							This will also cancel all active enrollments. This action cannot be undone.
						</p>
						<DialogFooter>
							<Button variant="outline" onClick={() => setDeleteId(null)}>
								Cancel
							</Button>
							<Button variant="destructive" onClick={handleDelete} disabled={deleting}>
								{deleting && <Loader2 size={13} className="animate-spin" />}
								Delete
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}
