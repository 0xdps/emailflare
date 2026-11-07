"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
	Search,
	Loader2,
	FlaskConical,
	Trash2,
	CheckCircle2,
	Play,
	Code2,
	FileText,
	Eye,
	Info,
	AlertTriangle,
} from "lucide-react";
import { TestEmailRow, getTestEmails, deleteTestEmail, clearAllTestEmails } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import HtmlEmailViewer from "./HtmlEmailViewer";
import { cn } from "@/lib/utils";

export default function TestInboxFolderView() {
	const router = useRouter();
	const [emails, setEmails] = useState<TestEmailRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [clearing, setClearing] = useState(false);
	const [showClearConfirm, setShowClearConfirm] = useState(false);
	const [detailTab, setDetailTab] = useState<"preview" | "text" | "raw" | "metadata">("preview");

	async function loadTestEmails() {
		setLoading(true);
		try {
			const res = await getTestEmails({
				search: search || undefined,
				limit: 50,
			});
			setEmails(res.data || []);
			if (res.data?.length > 0 && !selectedId) {
				setSelectedId(res.data[0].id);
			}
		} catch {
			setEmails([]);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		loadTestEmails();
	}, [search]);

	async function handleDelete(id: string) {
		setDeletingId(id);
		try {
			await deleteTestEmail(id);
			setEmails((prev) => prev.filter((e) => e.id !== id));
			if (selectedId === id) {
				const remaining = emails.filter((e) => e.id !== id);
				setSelectedId(remaining[0]?.id || null);
			}
		} finally {
			setDeletingId(null);
		}
	}

	async function handleClearAll() {
		setClearing(true);
		try {
			await clearAllTestEmails();
			setEmails([]);
			setSelectedId(null);
			setShowClearConfirm(false);
		} finally {
			setClearing(false);
		}
	}

	function handleRerunInPlayground(email: TestEmailRow) {
		const params = new URLSearchParams();
		if (email.from_address) params.set("from", email.from_address);
		if (email.to_address) params.set("to", email.to_address);
		if (email.subject) params.set("subject", email.subject);
		if (email.template_id) params.set("templateId", email.template_id);
		router.push(`/playground?${params.toString()}`);
	}

	const selected = emails.find((e) => e.id === selectedId) || null;

	return (
		<div className="flex h-full min-w-0 overflow-hidden bg-background">
			{/* Left Column: Test Emails List */}
			<div className="w-80 shrink-0 border-r border-border flex flex-col h-full bg-background">
				<div className="p-3 border-b border-border bg-background/95 shrink-0 space-y-2">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
							<FlaskConical size={14} />
							<span>Test Mailbox (Sandbox)</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="text-[10px] text-muted-foreground font-medium">
								{emails.length} captured
							</span>
							{emails.length > 0 && !showClearConfirm && (
								<button
									type="button"
									onClick={() => setShowClearConfirm(true)}
									className="text-[10px] text-muted-foreground hover:text-destructive underline decoration-dotted"
									title="Clear all captured test emails"
								>
									Clear all
								</button>
							)}
						</div>
					</div>

					{/* Clear confirmation pill */}
					{showClearConfirm && (
						<div className="flex items-center justify-between p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-[11px]">
							<span className="text-destructive font-medium">Clear all test emails?</span>
							<div className="flex items-center gap-1.5">
								<button
									type="button"
									onClick={handleClearAll}
									disabled={clearing}
									className="px-2 py-0.5 rounded bg-destructive text-destructive-foreground font-semibold hover:bg-destructive/90 transition-colors"
								>
									{clearing ? "Clearing..." : "Yes, clear"}
								</button>
								<button
									type="button"
									onClick={() => setShowClearConfirm(false)}
									className="px-1.5 py-0.5 rounded text-muted-foreground hover:bg-muted"
								>
									Cancel
								</button>
							</div>
						</div>
					)}

					<div className="relative">
						<Search
							size={13}
							className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
						/>
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search captured emails..."
							className="w-full h-7.5 pl-7 pr-3 rounded-md bg-muted/50 border border-border/70 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-purple-500 focus:bg-background"
						/>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto divide-y divide-border/60">
					{loading ? (
						<div className="flex items-center justify-center h-48">
							<Loader2 size={16} className="animate-spin text-muted-foreground" />
						</div>
					) : emails.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-64 px-4 text-center">
							<FlaskConical
								size={32}
								strokeWidth={1.5}
								className="text-purple-300 dark:text-purple-700 mb-2"
							/>
							<p className="text-xs font-semibold text-foreground">No test emails captured</p>
							<p className="text-[11px] text-muted-foreground mt-1 max-w-[200px]">
								Test sends from the Playground or test API keys (
								<code className="text-purple-600">eftest_</code>) are captured here automatically.
							</p>
						</div>
					) : (
						emails.map((row) => {
							const isSelected = row.id === selectedId;
							return (
								<button
									key={row.id}
									onClick={() => {
										setSelectedId(row.id);
										setDetailTab("preview");
									}}
									className={cn(
										"w-full text-left p-3 flex flex-col gap-1 transition-colors relative",
										isSelected ? "bg-purple-50/70 dark:bg-purple-950/20" : "hover:bg-muted/40",
									)}
								>
									{isSelected && (
										<span className="absolute left-0 top-0 bottom-0 w-[3px] bg-purple-500 rounded-r" />
									)}
									<div className="flex items-center justify-between text-xs">
										<span className="font-semibold text-foreground truncate max-w-[170px]">
											{row.to_address}
										</span>
										<span className="text-[10px] text-muted-foreground tabular-nums">
											{new Date(row.sent_at).toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</span>
									</div>
									<p className="text-xs font-medium text-foreground/90 truncate">
										{row.subject || (
											<span className="italic text-muted-foreground">No subject</span>
										)}
									</p>
									<div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
										<span className="truncate">From: {row.from_address}</span>
										<span className="ml-auto inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
											<CheckCircle2 size={10} />
											Captured
										</span>
									</div>
								</button>
							);
						})
					)}
				</div>
			</div>

			{/* Right Column: Detail View */}
			<div className="flex-1 min-w-0 h-full overflow-hidden flex flex-col bg-background">
				{selected ? (
					<div className="flex flex-col h-full overflow-hidden">
						{/* Detail Header */}
						<div className="px-6 py-4 border-b border-border bg-background shrink-0 flex items-start justify-between gap-4">
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2 mb-1.5 flex-wrap">
									<h1 className="text-[17px] font-bold text-foreground tracking-tight">
										{selected.subject || (
											<span className="italic text-muted-foreground">No subject</span>
										)}
									</h1>
									<span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
										SANDBOX
									</span>
								</div>

								<div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
									<div>
										<strong className="text-foreground">From:</strong> {selected.from_address}
									</div>
									<div>
										<strong className="text-foreground">To:</strong> {selected.to_address}
									</div>
									<div className="text-[11px] mt-0.5">
										Captured on {new Date(selected.sent_at).toLocaleString()}
									</div>
								</div>
							</div>

							{/* Actions: Re-run in Playground + Delete */}
							<div className="flex items-center gap-2 shrink-0">
								<Button
									variant="outline"
									size="sm"
									onClick={() => handleRerunInPlayground(selected)}
									className="h-8 gap-1.5 text-xs border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40"
								>
									<Play size={12} className="fill-current" />
									<span>Re-run in Playground</span>
								</Button>

								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleDelete(selected.id)}
									disabled={deletingId === selected.id}
									className="text-muted-foreground hover:text-destructive h-8 px-2 text-xs"
								>
									{deletingId === selected.id ? (
										<Loader2 size={13} className="animate-spin mr-1" />
									) : (
										<Trash2 size={13} className="mr-1" />
									)}
									Delete
								</Button>
							</div>
						</div>

						{/* Detail Tabs */}
						<Tabs
							value={detailTab}
							onValueChange={(v) => setDetailTab(v as typeof detailTab)}
							className="flex-1 flex flex-col overflow-hidden"
						>
							<div className="border-b border-border shrink-0 px-6 bg-muted/20">
								<TabsList className="bg-transparent h-10 gap-2 p-0">
									<TabsTrigger
										value="preview"
										className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-10 px-3 text-xs gap-1.5"
									>
										<Eye size={13} />
										<span>HTML Preview</span>
									</TabsTrigger>
									<TabsTrigger
										value="text"
										className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-10 px-3 text-xs gap-1.5"
									>
										<FileText size={13} />
										<span>Plain Text</span>
									</TabsTrigger>
									<TabsTrigger
										value="raw"
										className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-10 px-3 text-xs gap-1.5"
									>
										<Code2 size={13} />
										<span>Raw HTML</span>
									</TabsTrigger>
									<TabsTrigger
										value="metadata"
										className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-10 px-3 text-xs gap-1.5"
									>
										<Info size={13} />
										<span>Sandbox Metadata</span>
									</TabsTrigger>
								</TabsList>
							</div>

							<div className="flex-1 overflow-y-auto p-6">
								<TabsContent value="preview" className="m-0 h-full">
									<HtmlEmailViewer html={selected.html_body} text={selected.text_body} />
								</TabsContent>

								<TabsContent value="text" className="m-0">
									{selected.text_body ? (
										<pre className="p-4 rounded-lg border border-border bg-muted/30 font-mono text-xs whitespace-pre-wrap leading-relaxed">
											{selected.text_body}
										</pre>
									) : (
										<div className="text-center py-12 text-xs text-muted-foreground">
											No plain text body captured for this email.
										</div>
									)}
								</TabsContent>

								<TabsContent value="raw" className="m-0">
									{selected.html_body ? (
										<pre className="p-4 rounded-lg border border-border bg-muted/30 font-mono text-xs whitespace-pre-wrap leading-relaxed overflow-x-auto">
											{selected.html_body}
										</pre>
									) : (
										<div className="text-center py-12 text-xs text-muted-foreground">
											No raw HTML body captured for this email.
										</div>
									)}
								</TabsContent>

								<TabsContent value="metadata" className="m-0 space-y-4">
									<div className="rounded-xl border border-border p-4 bg-muted/10 space-y-3">
										<div className="text-xs font-semibold text-foreground uppercase tracking-wider">
											Sandbox Technical Attributes
										</div>
										<div className="grid grid-cols-2 gap-3 text-xs">
											<div>
												<span className="text-muted-foreground">Status:</span>{" "}
												<span className="font-semibold text-emerald-600 dark:text-emerald-400 capitalize">
													{selected.status} (Captured)
												</span>
											</div>
											<div>
												<span className="text-muted-foreground">Message ID:</span>{" "}
												<span className="font-mono text-[11px] select-all">
													{selected.cf_message_id || selected.id}
												</span>
											</div>
											<div>
												<span className="text-muted-foreground">Domain ID:</span>{" "}
												<span className="font-mono text-[11px]">
													{selected.domain_id || "None (Global)"}
												</span>
											</div>
											<div>
												<span className="text-muted-foreground">Template ID:</span>{" "}
												<span className="font-mono text-[11px]">
													{selected.template_id || "None"}
												</span>
											</div>
											<div>
												<span className="text-muted-foreground">Captured At:</span>{" "}
												<span className="tabular-nums">
													{new Date(selected.sent_at).toISOString()}
												</span>
											</div>
											<div>
												<span className="text-muted-foreground">Delivery Method:</span>{" "}
												<span className="text-purple-600 dark:text-purple-400 font-medium">
													In-Memory Sandbox Capture
												</span>
											</div>
										</div>
									</div>
								</TabsContent>
							</div>
						</Tabs>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground select-none">
						<FlaskConical
							size={36}
							strokeWidth={1.25}
							className="text-purple-300 dark:text-purple-800 mb-2"
						/>
						<p className="text-xs font-medium">Select a captured test email to view preview and metadata</p>
					</div>
				)}
			</div>
		</div>
	);
}
