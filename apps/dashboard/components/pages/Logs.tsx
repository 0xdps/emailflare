"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	CheckCircle2,
	XCircle,
	ChevronLeft,
	ChevronRight,
	Search,
	X,
	Mail,
	Hash,
	Clock,
	AlertTriangle,
	Server,
	Play,
	FlaskConical,
	Code2,
	Copy,
	Check,
	Eye,
	FileText,
	Info,
} from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import HtmlEmailViewer from "@/components/modules/inbox/HtmlEmailViewer";
import { cn } from "@/lib/utils";

export interface LogRow {
	id: string;
	to_address: string;
	from_address: string;
	subject: string;
	status: "sent" | "failed";
	cf_message_id: string | null;
	domain_id: string | null;
	template_id: string | null;
	api_key_id?: string | null;
	idempotency_key?: string | null;
	error: string | null;
	is_test: number;
	html_body?: string | null;
	text_body?: string | null;
	sent_at: string;
}

export interface PagedLogs {
	data: LogRow[];
	total: number;
	page: number;
	limit: number;
	pages: number;
}

const FILTER_OPTS = [
	{ label: "All", value: "" },
	{ label: "Delivered", value: "sent" },
	{ label: "Failed", value: "failed" },
	{ label: "Sandbox", value: "test" },
];

// ─── Right panel ────────────────────────────────────────────────────────────

function DetailPanel({ log }: { log: LogRow }) {
	const router = useRouter();
	const [fullLog, setFullLog] = useState<LogRow>(log);
	const [loadingDetail, setLoadingDetail] = useState(false);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		let isMounted = true;
		setLoadingDetail(true);
		api.get<LogRow>(`/api/logs/${log.id}`)
			.then((res) => {
				if (isMounted) setFullLog(res.data);
			})
			.catch(() => {
				if (isMounted) setFullLog(log);
			})
			.finally(() => {
				if (isMounted) setLoadingDetail(false);
			});
		return () => {
			isMounted = false;
		};
	}, [log]);

	const sentAt = new Date(fullLog.sent_at);
	const isSent = fullLog.status === "sent";
	const isTest = fullLog.is_test === 1;

	function handleRerunInPlayground() {
		const params = new URLSearchParams();
		if (fullLog.from_address) params.set("from", fullLog.from_address);
		if (fullLog.to_address) params.set("to", fullLog.to_address);
		if (fullLog.subject) params.set("subject", fullLog.subject);
		if (fullLog.template_id) params.set("templateId", fullLog.template_id);
		router.push(`/developer/playground?${params.toString()}`);
	}

	function handleCopyJson() {
		navigator.clipboard.writeText(JSON.stringify(fullLog, null, 2));
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	return (
		<div className="flex flex-col h-full overflow-hidden bg-background">
			{/* Detail Header */}
			<div className="px-6 py-4 border-b border-border flex-shrink-0 flex items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2 mb-1.5 flex-wrap">
						{isSent ? (
							<CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
						) : (
							<XCircle size={13} className="text-destructive shrink-0" />
						)}
						<span
							className={cn(
								"text-xs font-semibold",
								isSent ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
							)}
						>
							{isSent ? "Delivered" : "Failed"}
						</span>

						{isTest && (
							<span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
								SANDBOX
							</span>
						)}

						<span className="text-muted-foreground/30 text-xs">·</span>
						<span className="text-xs text-muted-foreground tabular-nums">{sentAt.toLocaleString()}</span>
					</div>

					<h2 className="text-[15px] font-semibold leading-snug line-clamp-2 text-foreground">
						{fullLog.subject || (
							<span className="text-muted-foreground italic font-normal">No subject</span>
						)}
					</h2>
				</div>

				<div className="flex items-center gap-2 shrink-0">
					<Button
						variant="outline"
						size="sm"
						onClick={handleRerunInPlayground}
						className="h-8 gap-1.5 text-xs text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40"
					>
						<Play size={12} className="fill-current" />
						<span>Playground</span>
					</Button>
				</div>
			</div>

			{/* Tabs */}
			<Tabs
				defaultValue={isTest && fullLog.html_body ? "preview" : "envelope"}
				className="flex flex-col flex-1 overflow-hidden"
			>
				<div className="border-b border-border shrink-0 px-6 bg-muted/20">
					<TabsList className="bg-transparent h-10 gap-2 p-0">
						<TabsTrigger
							value="envelope"
							className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-10 px-3 text-xs gap-1.5"
						>
							<Mail size={13} />
							<span>Envelope</span>
						</TabsTrigger>
						{fullLog.html_body && (
							<TabsTrigger
								value="preview"
								className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-10 px-3 text-xs gap-1.5"
							>
								<Eye size={13} />
								<span>HTML Body</span>
							</TabsTrigger>
						)}
						<TabsTrigger
							value="metadata"
							className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-10 px-3 text-xs gap-1.5"
						>
							<Info size={13} />
							<span>Metadata</span>
						</TabsTrigger>
						<TabsTrigger
							value="json"
							className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-10 px-3 text-xs gap-1.5"
						>
							<Code2 size={13} />
							<span>Event JSON</span>
						</TabsTrigger>
					</TabsList>
				</div>

				<div className="flex-1 overflow-y-auto p-6">
					{/* Tab 1: Envelope Header & Details */}
					<TabsContent value="envelope" className="m-0 space-y-4">
						<div className="bg-card border border-border rounded-xl overflow-hidden">
							<div className="px-5 py-4 border-b border-border flex flex-col gap-2.5 text-xs">
								{[
									{ label: "From", value: fullLog.from_address },
									{ label: "To", value: fullLog.to_address },
									{ label: "Subject", value: fullLog.subject || "—" },
									{
										label: "Sent At",
										value: sentAt.toLocaleString("en-US", {
											weekday: "short",
											year: "numeric",
											month: "short",
											day: "numeric",
											hour: "2-digit",
											minute: "2-digit",
											second: "2-digit",
										}),
									},
								].map(({ label, value }) => (
									<div key={label} className="flex items-start gap-3">
										<span className="text-muted-foreground w-16 shrink-0 font-medium">{label}</span>
										<span className="font-mono text-foreground break-all">{value}</span>
									</div>
								))}
							</div>

							<div className="px-5 py-6 flex flex-col items-center gap-3 text-center min-h-[140px] justify-center">
								<div
									className={cn(
										"size-10 rounded-full flex items-center justify-center",
										isSent
											? "bg-emerald-500/10 text-emerald-500"
											: "bg-destructive/10 text-destructive",
									)}
								>
									{isTest ? <FlaskConical size={18} /> : <Mail size={18} />}
								</div>
								<div>
									<p className="text-sm font-semibold text-foreground">
										{isTest
											? "Captured in Sandbox (Test Mailbox)"
											: isSent
												? "Dispatched via Cloudflare Email Routing"
												: "Email delivery failed"}
									</p>
									<p className="text-xs text-muted-foreground mt-1 max-w-sm">
										{isTest
											? "This message was delivered into the in-memory test mailbox for verification."
											: isSent
												? "Dispatched to Cloudflare's mail transfer agents for public delivery."
												: fullLog.error || "An error occurred during SMTP handoff."}
									</p>
								</div>
							</div>

							{fullLog.error && (
								<div className="px-5 py-4 border-t border-destructive/20 bg-destructive/10 flex items-start gap-2.5">
									<AlertTriangle size={14} className="text-destructive shrink-0 mt-0.5" />
									<div>
										<p className="text-xs font-semibold text-destructive mb-0.5">Delivery Error</p>
										<p className="text-xs text-destructive/90 font-mono break-all leading-relaxed">
											{fullLog.error}
										</p>
									</div>
								</div>
							)}
						</div>
					</TabsContent>

					{/* Tab 2: HTML Preview (if body stored) */}
					{fullLog.html_body && (
						<TabsContent value="preview" className="m-0 h-full">
							<HtmlEmailViewer html={fullLog.html_body} text={fullLog.text_body || null} />
						</TabsContent>
					)}

					{/* Tab 3: Technical Metadata */}
					<TabsContent value="metadata" className="m-0 space-y-4">
						<div className="grid grid-cols-2 gap-3 text-xs">
							{[
								{ label: "Log ID", value: fullLog.id, icon: Hash },
								{ label: "Cloudflare Message ID", value: fullLog.cf_message_id ?? "—", icon: Server },
								{ label: "Domain ID", value: fullLog.domain_id ?? "None (Global)", icon: Server },
								{ label: "Template ID", value: fullLog.template_id ?? "None (Inline)", icon: Server },
								{ label: "API Key ID", value: fullLog.api_key_id ?? "Session / UI", icon: Server },
								{
									label: "Mode",
									value: isTest ? "Sandbox (Test Mode)" : "Live Production",
									icon: isTest ? FlaskConical : Server,
								},
								{ label: "Timestamp (ISO)", value: sentAt.toISOString(), icon: Clock },
								{
									label: "Delivery Status",
									value: fullLog.status.toUpperCase(),
									icon: isSent ? CheckCircle2 : XCircle,
								},
							].map(({ label, value, icon: Icon }) => (
								<div key={label} className="bg-card border border-border rounded-xl p-3.5 space-y-1">
									<div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
										<Icon size={12} />
										<span>{label}</span>
									</div>
									<div className="font-mono text-xs text-foreground break-all select-all pt-0.5">
										{value}
									</div>
								</div>
							))}
						</div>
					</TabsContent>

					{/* Tab 4: Raw JSON Event */}
					<TabsContent value="json" className="m-0 space-y-3">
						<div className="flex justify-end">
							<Button
								variant="outline"
								size="sm"
								onClick={handleCopyJson}
								className="h-7 text-xs gap-1.5"
							>
								{copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
								<span>{copied ? "Copied" : "Copy JSON"}</span>
							</Button>
						</div>
						<pre className="p-4 rounded-xl border border-border bg-muted/30 font-mono text-xs text-foreground overflow-x-auto whitespace-pre-wrap leading-relaxed">
							{JSON.stringify(fullLog, null, 2)}
						</pre>
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function LogsPage({ initialResult }: { initialResult?: PagedLogs }) {
	const router = useRouter();
	const params = useSearchParams();
	const [result, setResult] = useState<PagedLogs | null>(initialResult ?? null);
	const [page, setPage] = useState(Number(params.get("page") ?? "1") || 1);
	const [filterVal, setFilterVal] = useState(params.get("status") ?? (params.get("isTest") === "1" ? "test" : ""));
	const [search, setSearch] = useState(params.get("search") ?? "");
	const [searchInput, setSearchInput] = useState(params.get("search") ?? "");
	const [from, setFrom] = useState(params.get("from") ?? "");
	const [to, setTo] = useState(params.get("to") ?? "");
	const [selected, setSelected] = useState<LogRow | null>(initialResult?.data?.[0] ?? null);
	const [loading, setLoading] = useState(initialResult === undefined);
	const isFirstMount = useRef(true);

	const load = useCallback(async () => {
		setLoading(true);
		const params = new URLSearchParams({ page: String(page), limit: "50" });

		if (filterVal === "sent" || filterVal === "failed") {
			params.set("status", filterVal);
		} else if (filterVal === "test") {
			params.set("isTest", "1");
		}

		if (search) params.set("search", search);
		if (from) params.set("from", from);
		if (to) params.set("to", to);

		try {
			const { data } = await api.get<PagedLogs>(`/api/logs?${params}`);
			setResult(data);
			setSelected((prev) => {
				if (prev && data.data?.some((d) => d.id === prev.id)) return prev;
				return data.data?.[0] ?? null;
			});
		} catch {
			setResult(null);
		} finally {
			setLoading(false);
		}
	}, [page, filterVal, search, from, to]);

	useEffect(() => {
		const next = new URLSearchParams();
		if (page > 1) next.set("page", String(page));
		if (filterVal === "sent" || filterVal === "failed") next.set("status", filterVal);
		if (filterVal === "test") next.set("isTest", "1");
		if (search) next.set("search", search);
		if (from) next.set("from", from);
		if (to) next.set("to", to);
		const query = next.toString();
		router.replace(query ? `/developer/logs?${query}` : "/developer/logs", { scroll: false });
	}, [page, filterVal, search, from, to, router]);

	useEffect(() => {
		if (isFirstMount.current) {
			isFirstMount.current = false;
			if (initialResult && !params.toString()) return;
		}
		load();
	}, [load, initialResult, params]);

	function handleFilter(val: string) {
		setFilterVal(val);
		setPage(1);
	}

	function handleSearch(e: React.FormEvent) {
		e.preventDefault();
		setSearch(searchInput);
		setPage(1);
	}

	function clearSearch() {
		setSearch("");
		setSearchInput("");
		setPage(1);
	}

	return (
		<div className="flex h-full min-w-0 overflow-hidden bg-background">
			{/* ── Left pane: Logs List (Width: 460px) ── */}
			<div className="w-[460px] shrink-0 border-r border-border flex flex-col h-full bg-background">
				{/* Pane Header */}
				<div className="p-4 border-b border-border bg-background/95 shrink-0 space-y-3">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-base font-semibold tracking-tight text-foreground">Activity Logs</h1>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								{result?.total ?? 0} total transactional events
							</p>
						</div>

						{/* Filter pills */}
						<div className="flex bg-muted/60 border border-border/80 rounded-lg p-0.5">
							{FILTER_OPTS.map((o) => (
								<button
									key={o.value}
									type="button"
									onClick={() => handleFilter(o.value)}
									className={cn(
										"text-[11px] font-medium px-2 py-0.5 rounded-md transition-all",
										filterVal === o.value
											? "bg-background shadow-xs text-foreground font-semibold"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{o.label}
								</button>
							))}
						</div>
					</div>

					{/* Search */}
					<form onSubmit={handleSearch} className="flex items-center gap-2">
						<div className="relative flex-1">
							<Search
								size={12}
								className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
							/>
							<Input
								value={searchInput}
								onChange={(e) => setSearchInput(e.target.value)}
								placeholder="Search to, from, subject..."
								className="pl-7 h-7.5 text-xs bg-muted/40"
							/>
						</div>
						{search && (
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="size-7.5"
								onClick={clearSearch}
							>
								<X size={12} />
							</Button>
						)}
					</form>
				</div>

				{/* Log list */}
				<div className="flex-1 overflow-y-auto divide-y divide-border/60">
					{loading ? (
						<div className="p-4 space-y-2">
							{[...Array(6)].map((_, i) => (
								<Skeleton key={i} className="h-14 rounded-lg" />
							))}
						</div>
					) : !result?.data || result.data.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-64 px-4 text-center text-muted-foreground">
							<Mail size={32} strokeWidth={1.25} className="opacity-40 mb-2" />
							<p className="text-xs font-semibold text-foreground">No logs found</p>
							<p className="text-[11px] mt-0.5 max-w-[200px]">
								{search || filterVal
									? "Try broadening your filters or search criteria."
									: "Transactional sends will be recorded here."}
							</p>
						</div>
					) : (
						result.data.map((row) => {
							const isSelected = row.id === selected?.id;
							const isSent = row.status === "sent";
							const isTest = row.is_test === 1;

							return (
								<button
									key={row.id}
									type="button"
									onClick={() => setSelected(row)}
									className={cn(
										"w-full text-left p-3 flex flex-col gap-1 transition-colors relative",
										isSelected ? "bg-muted/70 dark:bg-muted/40" : "hover:bg-muted/30",
									)}
								>
									{isSelected && (
										<span className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary rounded-r" />
									)}

									<div className="flex items-center justify-between text-xs">
										<div className="flex items-center gap-1.5 truncate max-w-[280px]">
											{isSent ? (
												<CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
											) : (
												<XCircle size={12} className="text-destructive shrink-0" />
											)}
											<span className="font-semibold text-foreground truncate">
												{row.to_address}
											</span>
										</div>

										<span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
											{new Date(row.sent_at).toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</span>
									</div>

									<p className="text-xs font-medium text-foreground/80 truncate">
										{row.subject || (
											<span className="italic text-muted-foreground font-normal">No subject</span>
										)}
									</p>

									<div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
										<span className="truncate max-w-[220px]">From: {row.from_address}</span>
										{isTest ? (
											<span className="px-1.5 py-0.2 rounded font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
												SANDBOX
											</span>
										) : (
											<span className="text-emerald-600 dark:text-emerald-400 font-medium">
												LIVE
											</span>
										)}
									</div>
								</button>
							);
						})
					)}
				</div>

				{/* Pagination Footer */}
				{result && result.pages > 1 && (
					<div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground shrink-0 bg-background">
						<span>
							Page {result.page} of {result.pages}
						</span>
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								disabled={page <= 1}
							>
								<ChevronLeft size={13} />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								onClick={() => setPage((p) => Math.min(result.pages, p + 1))}
								disabled={page >= result.pages}
							>
								<ChevronRight size={13} />
							</Button>
						</div>
					</div>
				)}
			</div>

			{/* ── Right pane: Log Detail View (Flex-1) ── */}
			<div className="flex-1 min-w-0 h-full overflow-hidden bg-background">
				{selected ? (
					<DetailPanel log={selected} />
				) : (
					<div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground select-none">
						<Mail size={36} strokeWidth={1.25} className="opacity-40 mb-2" />
						<p className="text-xs font-medium">
							Select a log event to view details, technical headers, and JSON
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
