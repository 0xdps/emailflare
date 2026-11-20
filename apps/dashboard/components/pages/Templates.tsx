"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, FileText, Cpu, X, Mail, ChevronDown, Play, Search } from "lucide-react";
import api from "@/lib/api";
import { createTemplateAction, updateTemplateAction, deleteTemplateAction } from "@/app/actions/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Template {
	id: string;
	name: string;
	slug: string | null;
	subject: string;
	html_body: string;
	text_body: string | null;
	layout: string | null;
	is_system: number;
	domain_id: string | null;
	variables: string[];
	created_at: string;
	updated_at: string;
}

type Mode = "list" | "create" | "edit";

const EMPTY_FORM = { name: "", slug: "", subject: "", htmlBody: "", textBody: "", domainId: "" };

const EMAIL_THEMES = [
	{ id: "default", label: "Default", color: "#f97316" },
	{ id: "ocean", label: "Ocean", color: "#0ea5e9" },
	{ id: "forest", label: "Forest", color: "#16a34a" },
	{ id: "violet", label: "Violet", color: "#7c3aed" },
	{ id: "slate", label: "Slate", color: "#334155" },
];

function ThemePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
	return (
		<div className="flex items-center gap-1.5">
			<span className="mr-0.5 text-2xs font-medium tracking-wider text-muted-foreground uppercase">Theme</span>
			{EMAIL_THEMES.map((t) => (
				<Button
					key={t.id}
					type="button"
					variant="ghost"
					size="icon-xs"
					title={t.label}
					aria-label={t.label}
					aria-pressed={value === t.id}
					onClick={() => onChange(t.id)}
					className={cn(
						"size-4 rounded-full border-2 p-0 transition-all duration-100 hover:bg-transparent dark:hover:bg-transparent",
						value === t.id
							? "scale-125 border-foreground shadow-sm"
							: "border-transparent opacity-50 hover:scale-110 hover:opacity-90",
					)}
					style={{ background: t.color }}
				/>
			))}
		</div>
	);
}

function WindowChrome({ subject }: { subject?: string }) {
	return (
		<div className="flex items-center gap-2 rounded-t-xl border border-b-0 border-border bg-muted px-4 py-2.5">
			<div className="flex gap-1.5">
				<div className="size-2.5 rounded-full bg-destructive" />
				<div className="size-2.5 rounded-full bg-warning" />
				<div className="size-2.5 rounded-full bg-success" />
			</div>
			{subject && <span className="ml-2 truncate font-mono text-2xs text-muted-foreground">{subject}</span>}
		</div>
	);
}

function extractVars(text: string): string[] {
	const vars = new Set<string>();
	for (const m of text.matchAll(/\{\{(\w+)\}\}/g)) if (m[1]) vars.add(m[1]);
	return Array.from(vars);
}

function TemplateCard({
	t,
	active,
	varsOpen,
	onToggleVars,
	onClick,
	detectedVars,
	varValues,
	onVarChange,
}: {
	t: Template;
	active: boolean;
	varsOpen: boolean;
	onToggleVars: (e: React.MouseEvent) => void;
	onClick: () => void;
	detectedVars: string[];
	varValues: Record<string, string>;
	onVarChange: (key: string, value: string) => void;
}) {
	const hasVars = t.variables.length > 0;
	return (
		<div
			className={cn(
				"w-full overflow-hidden rounded-xl border text-left transition-all duration-100",
				active ? "border-primary/20 bg-primary-muted" : "border-transparent hover:bg-muted/50",
			)}
		>
			<div onClick={onClick} className="cursor-pointer px-3 py-3">
				<div className="mb-0.5 flex items-start justify-between gap-2">
					<span className="truncate text-sm leading-tight font-medium text-foreground">{t.name}</span>
					{t.is_system === 1 && (
						<Badge variant="info" className="shrink-0 text-2xs uppercase">
							sys
						</Badge>
					)}
				</div>
				<div className="mt-0.5 flex items-center justify-between gap-2">
					<p className="truncate text-2xs leading-tight text-muted-foreground">{t.subject}</p>
					<div className="flex shrink-0 items-center gap-2">
						<span className="text-2xs text-muted-foreground/60">
							{new Date(t.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
						</span>
						{active && hasVars && (
							<Button
								type="button"
								variant="ghost"
								size="xs"
								onClick={onToggleVars}
								className={cn(
									"gap-0.5 text-2xs font-medium",
									varsOpen
										? "bg-primary-muted text-primary-muted-foreground hover:bg-primary-muted"
										: "bg-muted/60 text-muted-foreground",
								)}
							>
								<span>{t.variables.length} vars</span>
								<ChevronDown
									className={cn("size-3 transition-transform duration-150", varsOpen && "rotate-180")}
								/>
							</Button>
						)}
					</div>
				</div>
			</div>
			{active && varsOpen && detectedVars.length > 0 && (
				<div className="flex flex-col gap-2.5 border-t border-primary/10 px-3 pt-1 pb-3">
					{detectedVars.map((v) => (
						<div key={v}>
							<Label className="font-mono text-2xs text-primary">{`{{${v}}}`}</Label>
							<Input
								value={varValues[v] ?? ""}
								onChange={(e) => onVarChange(v, e.target.value)}
								placeholder={`Enter ${v}`}
								className="mt-1 h-7 text-xs"
							/>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

export interface TemplatesPageProps {
	initialTemplates?: Template[];
}

export default function TemplatesPage({ initialTemplates }: TemplatesPageProps = {}) {
	const router = useRouter();
	const [templates, setTemplates] = useState<Template[]>(initialTemplates ?? []);
	const [loading, setLoading] = useState(!initialTemplates);
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState("all");
	const [mode, setMode] = useState<Mode>("list");
	const [editing, setEditing] = useState<Template | null>(null);
	const [form, setForm] = useState(EMPTY_FORM);

	const [previewing, setPreviewing] = useState<Template | null>(null);
	const [previewVars, setPreviewVars] = useState<Record<string, string>>({});
	const [previewHtml, setPreviewHtml] = useState("");
	const [previewSubject, setPreviewSubject] = useState("");
	const [previewLoading, setPreviewLoading] = useState(false);
	const [varsOpen, setVarsOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
	const [previewThemeId, setPreviewThemeId] = useState("default");

	async function load() {
		setLoading(true);
		const { data } = await api.get<Template[]>("/api/templates");
		setTemplates(data);
		setLoading(false);
	}

	useEffect(() => {
		if (!initialTemplates) {
			load();
		}
	}, []);

	function openCreate() {
		setEditing(null);
		setForm(EMPTY_FORM);
		setMode("create");
	}

	function openEdit(t: Template) {
		setEditing(t);
		setForm({
			name: t.name,
			slug: t.slug ?? "",
			subject: t.subject,
			htmlBody: t.html_body,
			textBody: t.text_body ?? "",
			domainId: t.domain_id ?? "",
		});
		setMode("edit");
	}

	async function openPreview(t: Template, themeId = previewThemeId) {
		setPreviewing(t);
		setPreviewVars({});
		setPreviewHtml("");
		setPreviewSubject("");
		setVarsOpen(false);
		setPreviewLoading(true);
		try {
			const { data } = await api.post<{ html: string; subject: string }>(`/api/templates/${t.id}/preview`, {
				variables: {},
				themeId,
			});
			setPreviewHtml(data.html);
			setPreviewSubject(data.subject);
		} catch {
			setPreviewHtml('<p style="padding:1rem;color:red">Failed to render preview</p>');
		} finally {
			setPreviewLoading(false);
		}
	}

	async function refreshPreview(t: Template, vars: Record<string, string>, themeId = previewThemeId) {
		try {
			const { data } = await api.post<{ html: string; subject: string }>(`/api/templates/${t.id}/preview`, {
				variables: vars,
				themeId,
			});
			setPreviewHtml(data.html);
			setPreviewSubject(data.subject);
		} catch {
			/* keep previous */
		}
	}

	// Re-render preview when theme changes
	useEffect(() => {
		if (previewing) refreshPreview(previewing, previewVars, previewThemeId);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [previewThemeId]);

	async function handleSave(e: React.FormEvent) {
		e.preventDefault();
		const payload = {
			name: form.name,
			slug: form.slug,
			subject: form.subject,
			htmlBody: form.htmlBody,
			textBody: form.textBody || undefined,
			domainId: form.domainId || undefined,
		};
		if (mode === "create") {
			await createTemplateAction(payload);
		} else if (editing) {
			await updateTemplateAction(editing.id, payload);
		}
		setMode("list");
		load();
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		await deleteTemplateAction(deleteTarget.id);
		if (previewing?.id === deleteTarget.id) setPreviewing(null);
		setDeleteTarget(null);
		load();
	}

	const editPreviewVars = useMemo(
		() => extractVars(`${form.subject} ${form.htmlBody}`),
		[form.subject, form.htmlBody],
	);
	const [editVarValues, setEditVarValues] = useState<Record<string, string>>({});
	const editPreviewSubject = useMemo(() => {
		if (!form.subject) return "";
		return form.subject.replace(/\{\{(\w+)\}\}/g, (_, k) => editVarValues[k] ?? `{{${k}}}`);
	}, [form.subject, editVarValues]);
	const editPreviewHtml = useMemo(() => {
		if (!form.htmlBody) return "";
		const escHtml = (s: string) =>
			s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
		return form.htmlBody.replace(/\{\{(\w+)\}\}/g, (_, k) =>
			editVarValues[k]
				? `<span style="background:#fef9c3;color:#713f12;padding:0 2px;border-radius:2px">${escHtml(editVarValues[k])}</span>`
				: `<span style="background:#fee2e2;color:#991b1b;padding:0 2px;border-radius:2px;font-size:12px">{{${k}}}</span>`,
		);
	}, [form.htmlBody, editVarValues]);

	const previewDetectedVars = useMemo(() => {
		if (!previewing) return [];
		return previewing.variables.length > 0
			? previewing.variables
			: extractVars(`${previewing.subject} ${previewing.html_body}`);
	}, [previewing]);

	const systemTemplates = templates.filter((t) => t.is_system === 1);
	const customTemplates = templates.filter((t) => t.is_system === 0);

	const categories = ["all", ...new Set(templates.map((t) => (t.slug ?? t.name).split("-")[0]).filter(Boolean))];
	const q = search.trim().toLowerCase();
	const matches = (t: Template) => {
		const text = `${t.name} ${t.slug ?? ""} ${t.subject}`.toLowerCase();
		if (q && !text.includes(q)) return false;
		if (category !== "all" && !(t.slug ?? t.name).startsWith(category)) return false;
		return true;
	};
	const filteredSystemTemplates = systemTemplates.filter(matches);
	const filteredCustomTemplates = customTemplates.filter(matches);

	// ── Edit / Create view ───────────────────────────────────────────────────
	if (mode !== "list") {
		return (
			<div className="flex h-full">
				{/* Form panel */}
				<div className="w-[480px] flex-shrink-0 border-r border-border overflow-y-auto p-8">
					<div className="flex items-center justify-between mb-6">
						<h1 className="text-xl font-semibold tracking-tight">
							{mode === "create" ? "New template" : `Edit — ${editing?.name}`}
						</h1>
						<Button
							variant="ghost"
							size="icon"
							className="size-7"
							onClick={() => {
								setMode("list");
								setEditVarValues({});
							}}
						>
							<X className="size-3.5" />
						</Button>
					</div>
					<form onSubmit={handleSave} className="flex flex-col gap-4">
						<div className="flex flex-col gap-1.5">
							<Label>Name</Label>
							<Input
								value={form.name}
								onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
								required
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label>Subject</Label>
							<Input
								value={form.subject}
								onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
								required
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label>
								Slug <span className="text-muted-foreground font-normal">(required)</span>
							</Label>
							<Input
								value={form.slug}
								onChange={(e) =>
									setForm((f) => ({
										...f,
										slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
									}))
								}
								placeholder="welcome-email"
								className="font-mono"
								required
							/>
							<p className="text-2xs text-muted-foreground">
								Used as <code className="text-muted-foreground">templateSlug</code> in the send API.
							</p>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label>HTML body</Label>
							<Textarea
								value={form.htmlBody}
								onChange={(e) => setForm((f) => ({ ...f, htmlBody: e.target.value }))}
								required
								rows={12}
								className="font-mono"
								placeholder="<p>Hello {{name}},</p>"
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label>
								Plain-text body <span className="text-muted-foreground font-normal">(optional)</span>
							</Label>
							<Textarea
								value={form.textBody}
								onChange={(e) => setForm((f) => ({ ...f, textBody: e.target.value }))}
								rows={4}
								className="font-mono"
								placeholder="Hello {{name}}, ..."
							/>
						</div>
						<div className="flex gap-2 pt-2">
							<Button type="submit">{mode === "create" ? "Create" : "Save changes"}</Button>
							<Button
								type="button"
								variant="ghost"
								onClick={() => {
									setMode("list");
									setEditVarValues({});
								}}
							>
								Cancel
							</Button>
						</div>
					</form>
				</div>

				{/* Live preview panel */}
				<div className="flex-1 flex flex-col overflow-hidden">
					<div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
						<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
							Live Preview
						</span>
						{editPreviewSubject && (
							<span className="text-xs text-muted-foreground truncate max-w-xs">
								{editPreviewSubject}
							</span>
						)}
					</div>
					{editPreviewVars.length > 0 && (
						<div className="px-5 py-3 border-b border-border flex flex-wrap gap-3">
							{editPreviewVars.map((v) => (
								<div key={v} className="flex items-center gap-2">
									<span className="text-xs font-mono text-primary">{`{{${v}}}`}</span>
									<Input
										value={editVarValues[v] ?? ""}
										onChange={(e) => setEditVarValues((p) => ({ ...p, [v]: e.target.value }))}
										placeholder={v}
										className="h-7 text-xs w-28"
									/>
								</div>
							))}
						</div>
					)}
					<div className="flex-1 relative">
						{editPreviewHtml ? (
							<div className="h-full overflow-auto">
								<div className="p-4">
									<div className="max-w-[640px] mx-auto">
										<WindowChrome subject={editPreviewSubject} />
										<div className="overflow-hidden rounded-b-xl border border-t-0 border-border bg-white">
											<iframe
												srcDoc={editPreviewHtml}
												className="h-full w-full border-0 bg-white"
												style={{ minHeight: "400px" }}
												sandbox="allow-same-origin"
												title="Template preview"
											/>
										</div>
									</div>
								</div>
							</div>
						) : (
							<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
								<Mail className="size-10" strokeWidth={1} />
								<p className="text-sm">Your preview will appear here</p>
							</div>
						)}
					</div>
				</div>
			</div>
		);
	}

	// ── List view ────────────────────────────────────────────────────────────
	return (
		<div className="flex h-full">
			{/* Delete confirm dialog */}
			<Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete template?</DialogTitle>
						<DialogDescription>
							"{deleteTarget?.name}" will be permanently removed and cannot be restored.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteTarget(null)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={confirmDelete}>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ── Left pane: template list ──────────────────────────────────── */}
			<div className="w-[560px] flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
				<div className="flex flex-shrink-0 items-center justify-between px-5 pt-5 pb-4">
					<div>
						<div className="mb-1 flex items-center gap-2">
							<FileText className="size-3.5 text-primary" />
							<span className="text-2xs font-medium tracking-wider text-muted-foreground uppercase">
								Email
							</span>
						</div>
						<h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
						<div className="mt-1 flex items-center gap-2 text-2xs text-muted-foreground">
							<span>{templates.length} total</span>
							<span>•</span>
							<span>{systemTemplates.length} built-in</span>
							<span>•</span>
							<span>{customTemplates.length} custom</span>
						</div>
					</div>
					<Button onClick={openCreate}>
						<Plus className="size-4" data-icon="inline-start" /> New template
					</Button>
				</div>

				<div className="px-5 pb-3">
					<InputGroup>
						<InputGroupAddon>
							<Search className="size-4" />
						</InputGroupAddon>
						<InputGroupInput
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search templates by name, slug, or subject..."
						/>
					</InputGroup>
					<ToggleGroup
						value={[category]}
						onValueChange={(v) => v[0] && setCategory(v[0])}
						variant="outline"
						size="sm"
						spacing={1}
						className="mt-2 max-w-full overflow-x-auto"
					>
						{categories.slice(0, 8).map((item) => (
							<ToggleGroupItem key={item} value={item} className="rounded-full px-2.5 text-2xs">
								{item}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</div>

				<ScrollArea className="flex-1 min-h-0">
					{loading ? (
						<div className="p-3 flex flex-col gap-1.5">
							{[...Array(5)].map((_, i) => (
								<Skeleton key={i} className="h-[70px] rounded-lg" />
							))}
						</div>
					) : (
						<div className="p-2 flex flex-col gap-4">
							{systemTemplates.length > 0 && (
								<div>
									<div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
										<Cpu className="size-3 text-info" />
										<span className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
											Built-in ({filteredSystemTemplates.length})
										</span>
									</div>
									<div className="flex flex-col gap-px">
										{filteredSystemTemplates.map((t) => (
											<TemplateCard
												key={t.id}
												t={t}
												active={previewing?.id === t.id}
												varsOpen={previewing?.id === t.id && varsOpen}
												onToggleVars={(e) => {
													e.stopPropagation();
													setVarsOpen((v) => !v);
												}}
												onClick={() => openPreview(t)}
												detectedVars={previewing?.id === t.id ? previewDetectedVars : []}
												varValues={previewVars}
												onVarChange={(key, val) => {
													const next = { ...previewVars, [key]: val };
													setPreviewVars(next);
													if (previewing) refreshPreview(previewing, next);
												}}
											/>
										))}
									</div>
								</div>
							)}

							<div>
								<div className="flex items-center gap-1.5 px-3 pb-1">
									<FileText className="size-3 text-primary" />
									<span className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
										Custom ({filteredCustomTemplates.length})
									</span>
								</div>
								{filteredCustomTemplates.length === 0 ? (
									<div className="px-3 py-6 text-center">
										{q ? (
											<p className="text-2xs text-muted-foreground">
												No custom templates match "{search}"
											</p>
										) : (
											<>
												<p className="text-2xs text-muted-foreground">
													No custom templates yet
												</p>
												<Button
													variant="link"
													size="sm"
													onClick={openCreate}
													className="mt-1 h-auto p-0 text-2xs"
												>
													Create your first →
												</Button>
											</>
										)}
									</div>
								) : (
									<div className="flex flex-col gap-px">
										{filteredCustomTemplates.map((t) => (
											<TemplateCard
												key={t.id}
												t={t}
												active={previewing?.id === t.id}
												varsOpen={previewing?.id === t.id && varsOpen}
												onToggleVars={(e) => {
													e.stopPropagation();
													setVarsOpen((v) => !v);
												}}
												onClick={() => openPreview(t)}
												detectedVars={previewing?.id === t.id ? previewDetectedVars : []}
												varValues={previewVars}
												onVarChange={(key, val) => {
													const next = { ...previewVars, [key]: val };
													setPreviewVars(next);
													if (previewing) refreshPreview(previewing, next);
												}}
											/>
										))}
									</div>
								)}
							</div>
						</div>
					)}
				</ScrollArea>
			</div>

			{/* ── Right pane: preview ───────────────────────────────────────── */}
			<div className="flex-1 overflow-hidden flex flex-col">
				{!previewing ? (
					<Empty className="h-full select-none">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Mail />
							</EmptyMedia>
							<EmptyTitle className="text-sm font-normal text-muted-foreground">
								Select a template to preview
							</EmptyTitle>
						</EmptyHeader>
						<EmptyContent>
							<Button variant="link" size="sm" onClick={openCreate} className="h-auto p-0 text-xs">
								or create a new one →
							</Button>
						</EmptyContent>
					</Empty>
				) : (
					<>
						{/* Header */}
						<div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-4">
							<div className="min-w-0">
								<div className="mb-0.5 flex flex-wrap items-center gap-2">
									<h2 className="text-base leading-tight font-semibold">{previewing.name}</h2>
									{previewing.is_system === 1 && (
										<Badge variant="info" className="text-2xs tracking-wide uppercase">
											built-in
										</Badge>
									)}
									{previewing.slug && (
										<Badge variant="outline" className="font-mono text-2xs text-primary">
											{previewing.slug}
										</Badge>
									)}
								</div>
								<p className="truncate text-xs text-muted-foreground">
									{previewSubject || previewing.subject}
								</p>
							</div>
							<div className="flex flex-shrink-0 flex-wrap items-center gap-2">
								<ThemePicker value={previewThemeId} onChange={(id) => setPreviewThemeId(id)} />
								<Button
									variant="outline"
									size="sm"
									className="gap-1.5 border-info/30 text-xs text-info-muted-foreground hover:bg-info-muted"
									onClick={() => router.push(`/playground?templateId=${previewing.id}`)}
								>
									<Play className="size-3 fill-current" /> Test in Playground
								</Button>
								{previewing.is_system === 0 && (
									<div className="flex items-center gap-1.5">
										<Button
											variant="outline"
											size="sm"
											className="gap-1.5 text-xs"
											onClick={() => openEdit(previewing)}
										>
											<Pencil className="size-3" /> Edit
										</Button>
										<Button
											variant="outline"
											size="sm"
											className="gap-1.5 text-xs text-muted-foreground hover:border-destructive/40 hover:text-destructive"
											onClick={() => setDeleteTarget(previewing)}
										>
											<Trash2 className="size-3" /> Delete
										</Button>
									</div>
								)}
							</div>
						</div>

						{/* Email preview */}
						<ScrollArea className="flex-1">
							<div className="p-6">
								{previewLoading ? (
									<div className="flex h-32 items-center justify-center gap-2 text-muted-foreground">
										<Spinner className="size-3.5" />
										<span className="text-xs">Rendering…</span>
									</div>
								) : previewHtml ? (
									<div className="mx-auto max-w-[640px]">
										<WindowChrome subject={previewSubject || previewing.subject} />
										<div className="overflow-hidden rounded-b-xl border border-t-0 border-border bg-white shadow-lg">
											<iframe
												srcDoc={previewHtml}
												className="w-full border-0 block"
												style={{ minHeight: "480px", height: "auto" }}
												sandbox="allow-same-origin"
												title="Template preview"
												onLoad={(e) => {
													const iframe = e.currentTarget;
													const body = iframe.contentDocument?.body;
													if (body) iframe.style.height = body.scrollHeight + "px";
												}}
											/>
										</div>
									</div>
								) : (
									<div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
										<Mail className="size-5 opacity-40" strokeWidth={1} />
										<p className="text-xs">No preview available</p>
									</div>
								)}
							</div>
						</ScrollArea>
					</>
				)}
			</div>
		</div>
	);
}

interface Template {
	id: string;
	name: string;
	slug: string | null;
	subject: string;
	html_body: string;
	text_body: string | null;
	layout: string | null;
	is_system: number;
	domain_id: string | null;
	variables: string[];
	created_at: string;
	updated_at: string;
}
