import { useEffect, useRef, useState } from "react";
import {
	Globe,
	Send,
	RefreshCw,
	CheckCircle2,
	XCircle,
	ArrowRight,
	TrendingUp,
	AlertTriangle,
	Mail,
	Activity,
} from "lucide-react";
import api from "../api";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DomainBreakdown {
	name: string;
	verified: boolean;
	sent: number;
	failed: number;
}

interface DailyBucket {
	date: string;
	sent: number;
	failed: number;
}

interface Stats {
	totalDomains: number;
	verifiedDomains: number;
	totalTemplates: number;
	totalKeys: number;
	totalEmails: number;
	sentToday: number;
	failedToday: number;
	cfDailyLimit: number;
	domainBreakdown: DomainBreakdown[];
	daily: DailyBucket[];
}

interface CFTokenStatus {
	configured: boolean;
	active: boolean;
	tokenStatus: string | null;
	tokenId: string | null;
	notBefore: string | null;
	expiresOn: string | null;
	accountId: string | null;
	accountName: string | null;
	message: string;
}

interface LogRow {
	id: string;
	to_address: string;
	from_address: string;
	subject: string;
	status: "sent" | "failed";
	error: string | null;
	sent_at: string;
}

const RANGES = ["1d", "7d", "30d"] as const;
type Range = (typeof RANGES)[number];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
	return n.toLocaleString();
}

function timeAgo(iso: string): string {
	const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
	if (secs < 60) return `${secs}s ago`;
	if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
	if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
	return `${Math.floor(secs / 86400)}d ago`;
}

function shortDate(iso: string): string {
	return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Chart ────────────────────────────────────────────────────────────────────

function smoothPath(pts: { x: number; y: number }[]): string {
	if (!pts.length) return "";
	let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
	for (let i = 0; i < pts.length - 1; i++) {
		const dx = (pts[i + 1].x - pts[i].x) * 0.45;
		d += ` C ${(pts[i].x + dx).toFixed(2)} ${pts[i].y.toFixed(2)},${(pts[i + 1].x - dx).toFixed(2)} ${pts[i + 1].y.toFixed(2)},${pts[i + 1].x.toFixed(2)} ${pts[i + 1].y.toFixed(2)}`;
	}
	return d;
}

interface TooltipState {
	x: number;
	y: number;
	d: DailyBucket;
}

function AreaChart({ daily }: { daily: DailyBucket[] }) {
	const [tooltip, setTooltip] = useState<TooltipState | null>(null);
	const svgRef = useRef<SVGSVGElement>(null);

	const W = 1000,
		H = 180;
	const padX = 8,
		padY = 20,
		padBottom = 4;
	const plotH = H - padY - padBottom;
	const plotW = W - padX * 2;

	if (!daily.length) {
		return (
			<div className="h-[180px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
				<TrendingUp size={20} className="opacity-40" />
				<span className="text-xs">No data for this period</span>
			</div>
		);
	}

	const maxVal = Math.max(...daily.map((d) => d.sent), 1);
	const pts = daily.map((d, i) => ({
		x: padX + (daily.length > 1 ? (i / (daily.length - 1)) * plotW : plotW / 2),
		y: padY + (1 - d.sent / maxVal) * plotH,
		...d,
	}));

	const linePath = smoothPath(pts);
	const first = pts[0],
		last = pts[pts.length - 1];
	const areaPath = `${linePath} L ${last.x.toFixed(2)} ${(H - padBottom).toFixed(2)} L ${first.x.toFixed(2)} ${(H - padBottom).toFixed(2)} Z`;

	const yGrid = [0, 0.25, 0.5, 0.75, 1];

	function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
		if (!svgRef.current) return;
		const rect = svgRef.current.getBoundingClientRect();
		const rawX = ((e.clientX - rect.left) / rect.width) * W;
		const idx = Math.min(daily.length - 1, Math.max(0, Math.round(((rawX - padX) / plotW) * (daily.length - 1))));
		setTooltip({ x: pts[idx].x, y: pts[idx].y, d: daily[idx] });
	}

	return (
		<div className="relative select-none">
			<svg
				ref={svgRef}
				width="100%"
				viewBox={`0 0 ${W} ${H}`}
				preserveAspectRatio="none"
				style={{ height: 180, overflow: "visible" }}
				onMouseMove={handleMouseMove}
				onMouseLeave={() => setTooltip(null)}
				className="cursor-crosshair"
			>
				<defs>
					<linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="#f97316" stopOpacity="0.12" />
						<stop offset="85%" stopColor="#f97316" stopOpacity="0" />
					</linearGradient>
					<linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
						<stop offset="0%" stopColor="#f97316" stopOpacity="0.6" />
						<stop offset="100%" stopColor="#f97316" stopOpacity="1" />
					</linearGradient>
				</defs>

				{yGrid.map((t) => {
					const gy = padY + (1 - t) * plotH;
					return (
						<line
							key={t}
							x1={padX}
							x2={W - padX}
							y1={gy}
							y2={gy}
							stroke="currentColor"
							strokeOpacity="0.06"
							strokeWidth="1"
							className="text-foreground"
						/>
					);
				})}

				<path d={areaPath} fill="url(#areaFill)" />
				<path
					d={linePath}
					stroke="url(#lineGrad)"
					strokeWidth="2"
					fill="none"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>

				{tooltip && (
					<>
						<line
							x1={tooltip.x}
							x2={tooltip.x}
							y1={padY}
							y2={H - padBottom}
							stroke="currentColor"
							strokeOpacity="0.1"
							strokeWidth="1"
							strokeDasharray="4 3"
							className="text-foreground"
						/>
						<circle
							cx={tooltip.x}
							cy={tooltip.y}
							r={4}
							fill="#ea580c"
							stroke="var(--color-card)"
							strokeWidth="2"
						/>
					</>
				)}
			</svg>

			{tooltip &&
				(() => {
					const pct = tooltip.x / W;
					return (
						<div
							className="absolute -top-2 pointer-events-none z-10"
							style={{
								left: `${pct * 100}%`,
								transform: pct > 0.7 ? "translateX(-100%)" : "translateX(-50%)",
							}}
						>
							<div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-xl text-xs whitespace-nowrap">
								<p className="text-muted-foreground mb-1">{shortDate(tooltip.d.date)}</p>
								<p className="text-foreground font-medium">{tooltip.d.sent.toLocaleString()} sent</p>
								{tooltip.d.failed > 0 && <p className="text-destructive">{tooltip.d.failed} failed</p>}
							</div>
						</div>
					);
				})()}

			{daily.length > 1 && (
				<div className="flex justify-between mt-2 px-1">
					{daily.length <= 8
						? daily.map((d, i) => (
								<span key={i} className="text-[10px] text-muted-foreground/50 tabular-nums">
									{shortDate(d.date)}
								</span>
							))
						: [
								0,
								Math.floor(daily.length / 4),
								Math.floor(daily.length / 2),
								Math.floor((daily.length * 3) / 4),
								daily.length - 1,
							].map((i) => (
								<span key={i} className="text-[10px] text-muted-foreground/50 tabular-nums">
									{shortDate(daily[i].date)}
								</span>
							))}
				</div>
			)}
		</div>
	);
}

// ─── Page Skeleton ────────────────────────────────────────────────────────────

function DashboardSkeleton() {
	return (
		<div className="p-6 lg:p-8 min-h-full flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<div className="flex flex-col gap-1.5">
					<Skeleton className="h-5 w-24" />
					<Skeleton className="h-3 w-40" />
				</div>
				<div className="flex gap-2">
					<Skeleton className="h-8 w-28" />
					<Skeleton className="h-8 w-8" />
				</div>
			</div>
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
				{[...Array(4)].map((_, i) => (
					<Skeleton key={i} className="h-[100px] rounded-xl" />
				))}
			</div>
			<Skeleton className="h-[260px] rounded-xl" />
			<div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
				<Skeleton className="lg:col-span-3 h-[240px] rounded-xl" />
				<Skeleton className="lg:col-span-2 h-[240px] rounded-xl" />
			</div>
		</div>
	);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
	const [stats, setStats] = useState<Stats | null>(null);
	const [logs, setLogs] = useState<LogRow[]>([]);
	const [cfStatus, setCfStatus] = useState<CFTokenStatus | null>(null);
	const [refreshing, setRefreshing] = useState(false);
	const [range, setRange] = useState<Range>("7d");

	async function load(r: Range = range) {
		setRefreshing(true);
		try {
			const [s, l, cf] = await Promise.all([
				api.get<Stats>(`/api/stats?range=${r}`),
				api.get<{ data: LogRow[] }>("/api/logs?limit=10&page=1"),
				api.get<CFTokenStatus>("/api/cloudflare/status").catch(() => null),
			]);
			setStats(s.data);
			setLogs(l.data.data ?? []);
			setCfStatus(cf?.data ?? null);
		} finally {
			setRefreshing(false);
		}
	}

	useEffect(() => {
		load(range);
	}, [range]); // eslint-disable-line react-hooks/exhaustive-deps

	if (!stats) return <DashboardSkeleton />;

	const totalToday = stats.sentToday + stats.failedToday;
	const deliveryRate = totalToday > 0 ? (stats.sentToday / totalToday) * 100 : 100;
	const deliveryPct = deliveryRate.toFixed(1);
	const rateColor = deliveryRate >= 95 ? "#10b981" : deliveryRate >= 80 ? "#f59e0b" : "#ef4444";
	const rateLabel = deliveryRate >= 95 ? "Healthy" : deliveryRate >= 80 ? "Degraded" : "Critical";

	const limitPct = Math.min(100, (stats.sentToday / stats.cfDailyLimit) * 100);
	const limitRemaining = stats.cfDailyLimit - stats.sentToday;

	return (
		<div className="p-6 lg:p-8 min-h-full flex flex-col gap-4">
			{/* ── Header ─────────────────────────────────────────────────────────── */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
					<p className="text-xs text-muted-foreground mt-0.5">
						{new Date().toLocaleDateString("en-US", {
							weekday: "long",
							month: "long",
							day: "numeric",
							year: "numeric",
						})}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<div className="flex bg-card border border-border rounded-lg p-[3px]">
						{RANGES.map((r) => (
							<button
								key={r}
								onClick={() => setRange(r)}
								className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all duration-150 ${
									range === r
										? "bg-card text-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								{r}
							</button>
						))}
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={() => load(range)}
						disabled={refreshing}
						aria-label="Refresh"
						className="size-8"
					>
						<RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
					</Button>
				</div>
			</div>

			{/* ── Cloudflare token status ───────────────────────────────────────── */}
			<Card className="px-5 py-4">
				<div className="flex items-start justify-between gap-3">
					<div>
						<p className="text-sm font-medium">Cloudflare token</p>
						<p className="text-xs text-muted-foreground mt-0.5">Connection state and account ownership</p>
					</div>
					{cfStatus?.active ? (
						<Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Active</Badge>
					) : (
						<Badge variant="destructive">Inactive</Badge>
					)}
				</div>

				{cfStatus ? (
					<div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
						<div className="rounded-lg border border-border p-3 bg-muted/20">
							<p className="text-muted-foreground mb-1">Account</p>
							<p className="font-medium text-foreground break-all">
								{cfStatus.accountName ?? "Unknown account"}
							</p>
							<p className="text-muted-foreground/80 mt-1 break-all">
								{cfStatus.accountId ?? "No account id configured"}
							</p>
						</div>
						<div className="rounded-lg border border-border p-3 bg-muted/20">
							<p className="text-muted-foreground mb-1">Token status</p>
							<p className="font-medium text-foreground">
								{cfStatus.tokenStatus ?? (cfStatus.configured ? "unknown" : "not configured")}
							</p>
							{cfStatus.expiresOn && (
								<p className="text-muted-foreground/80 mt-1">
									Expires: {new Date(cfStatus.expiresOn).toLocaleString()}
								</p>
							)}
						</div>
						<p className="text-muted-foreground md:col-span-2">{cfStatus.message}</p>
					</div>
				) : (
					<p className="text-xs text-muted-foreground mt-3">Unable to fetch Cloudflare token status.</p>
				)}
			</Card>

			{/* ── KPI tiles ──────────────────────────────────────────────────────── */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
				{/* Sent today */}
				<Card className="p-4">
					<div className="flex items-center gap-1.5 mb-3">
						<div className="size-5 rounded-md bg-orange-50 flex items-center justify-center">
							<Send size={11} className="text-primary" />
						</div>
						<p className="text-[11px] font-semibold text-muted-foreground">Sent today</p>
					</div>
					<p className="text-[26px] font-bold tabular-nums tracking-tight leading-none text-foreground">
						{fmt(stats.sentToday)}
					</p>
					<p className="text-[11.5px] text-muted-foreground mt-2">
						{stats.failedToday > 0 ? (
							<span className="text-destructive">{stats.failedToday} failed</span>
						) : (
							<span className="text-emerald-600">&#10003; All delivered</span>
						)}
					</p>
				</Card>

				{/* All-time */}
				<Card className="p-4">
					<div className="flex items-center gap-1.5 mb-3">
						<div className="size-5 rounded-md bg-blue-50 flex items-center justify-center">
							<Mail size={11} className="text-blue-500" />
						</div>
						<p className="text-[11px] font-semibold text-muted-foreground">All-time</p>
					</div>
					<p className="text-[26px] font-bold tabular-nums tracking-tight leading-none text-foreground">
						{fmt(stats.totalEmails)}
					</p>
					<p className="text-[11.5px] text-muted-foreground mt-2">emails delivered</p>
				</Card>

				{/* Delivery rate */}
				<Card className="p-4">
					<div className="flex items-center gap-1.5 mb-3">
						<div
							className="size-5 rounded-md flex items-center justify-center"
							style={{ background: `${rateColor}15` }}
						>
							<Activity size={11} style={{ color: rateColor }} />
						</div>
						<p className="text-[11px] font-semibold text-muted-foreground">Delivery rate</p>
					</div>
					<p
						className="text-[26px] font-bold tabular-nums tracking-tight leading-none"
						style={{ color: rateColor }}
					>
						{deliveryPct}%
					</p>
					<div className="mt-2">
						<span
							className={cn(
								"inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md",
								deliveryRate >= 95
									? "bg-emerald-50 text-emerald-700"
									: deliveryRate >= 80
										? "bg-amber-50 text-amber-700"
										: "bg-red-50 text-red-700",
							)}
						>
							{deliveryRate < 95 && <AlertTriangle size={9} />}
							{rateLabel}
						</span>
					</div>
				</Card>

				{/* CF Daily quota */}
				<Card className="p-4">
					<div className="flex items-center gap-1.5 mb-3">
						<div className="size-5 rounded-md bg-violet-50 flex items-center justify-center">
							<TrendingUp size={11} className="text-violet-500" />
						</div>
						<p className="text-[11px] font-semibold text-muted-foreground">Daily quota</p>
					</div>
					<p className="text-[26px] font-bold tabular-nums tracking-tight leading-none text-foreground">
						{fmt(stats.sentToday)}
					</p>
					<p className="text-[11.5px] text-muted-foreground mt-2">
						{fmt(limitRemaining)} of {fmt(stats.cfDailyLimit)} remaining
					</p>
					<div className="mt-2.5">
						<div className="h-1 bg-muted rounded-full overflow-hidden">
							<div
								className="h-full rounded-full transition-all duration-700"
								style={{
									width: `${limitPct}%`,
									backgroundColor:
										limitPct >= 90 ? "#ef4444" : limitPct >= 70 ? "#f59e0b" : "#ea580c",
								}}
							/>
						</div>
						<p className="text-[10px] text-muted-foreground/50 mt-1">{limitPct.toFixed(1)}% used</p>
					</div>
				</Card>
			</div>

			{/* ── Volume chart ────────────────────────────────────────────────────── */}
			<Card className="px-5 pt-5 pb-3">
				<div className="flex items-center justify-between mb-4">
					<div>
						<p className="text-sm font-medium">Email volume</p>
						<p className="text-xs text-muted-foreground mt-0.5">
							{stats.daily.reduce((a, d) => a + d.sent, 0).toLocaleString()} sent ·{" "}
							{range === "1d" ? "past 24h" : range === "7d" ? "past 7 days" : "past 30 days"}
						</p>
					</div>
					<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
						<span className="w-3 h-[2px] bg-primary rounded inline-block" />
						Sent
					</div>
				</div>
				<AreaChart daily={stats.daily} />
			</Card>

			{/* ── Bottom 2-col ────────────────────────────────────────────────────── */}
			<div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
				{/* Domain breakdown */}
				<Card className="lg:col-span-3 overflow-hidden p-0 gap-0">
					<div className="flex items-center justify-between px-5 py-[14px] border-b border-border">
						<div>
							<p className="text-sm font-medium">Domains</p>
							<p className="text-xs text-muted-foreground mt-0.5">
								{stats.totalDomains} total · {stats.verifiedDomains} verified
							</p>
						</div>
						<a
							href="/domains"
							className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
						>
							Manage <ArrowRight size={10} />
						</a>
					</div>

					{stats.domainBreakdown.length === 0 ? (
						<div className="py-12 flex flex-col items-center gap-2 text-muted-foreground">
							<Globe size={18} className="opacity-40" />
							<span className="text-xs">No domains configured yet</span>
						</div>
					) : (
						<div className="divide-y divide-border">
							{stats.domainBreakdown.map((d) => {
								const total = d.sent + d.failed;
								const rate = total > 0 ? Math.round((d.sent / total) * 100) : null;
								const share =
									stats.cfDailyLimit > 0
										? Math.min(100, Math.round((d.sent / stats.cfDailyLimit) * 100))
										: 0;
								const shareColor = share >= 50 ? "#ef4444" : share >= 25 ? "#f59e0b" : "#10b981";
								return (
									<div key={d.name} className="px-5 py-3.5 hover:bg-muted/50 transition-colors">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2 min-w-0">
												<span
													className={`size-1.5 rounded-full flex-shrink-0 ${d.verified ? "bg-emerald-500" : "bg-amber-500/60"}`}
												/>
												<span className="text-[13px] text-foreground font-mono truncate">
													{d.name}
												</span>
											</div>
											<div className="flex items-center gap-4 text-xs flex-shrink-0 ml-3">
												{total === 0 ? (
													<span className="text-muted-foreground tabular-nums">
														No emails yet
													</span>
												) : (
													<>
														<span className="text-muted-foreground tabular-nums">
															{d.sent.toLocaleString()} sent
														</span>
														{d.failed > 0 && (
															<span className="text-destructive tabular-nums">
																{d.failed} failed
															</span>
														)}
														{rate !== null && (
															<span
																className="font-medium tabular-nums"
																style={{ color: rate >= 95 ? "#10b981" : "#f59e0b" }}
															>
																{rate}%
															</span>
														)}
													</>
												)}
											</div>
										</div>
										{/* {total > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-0.5 bg-border rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${share}%`, backgroundColor: shareColor }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground/50 tabular-nums w-8 text-right">{share}%</span>
                      </div>
                    )} */}
									</div>
								);
							})}
						</div>
					)}

					{stats.totalDomains > stats.verifiedDomains && (
						<div className="px-5 py-3 border-t border-border flex items-center gap-2">
							<span className="size-1.5 rounded-full bg-amber-500/60 flex-shrink-0" />
							<span className="text-xs text-muted-foreground">
								{stats.totalDomains - stats.verifiedDomains} domain
								{stats.totalDomains - stats.verifiedDomains !== 1 ? "s" : ""} pending DNS verification
							</span>
						</div>
					)}
				</Card>

				{/* Recent activity */}
				<Card className="lg:col-span-2 overflow-hidden p-0 gap-0">
					<div className="flex items-center justify-between px-5 py-[14px] border-b border-border">
						<p className="text-sm font-medium">Recent activity</p>
						<a
							href="/logs"
							className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
						>
							All logs <ArrowRight size={10} />
						</a>
					</div>

					{logs.length === 0 ? (
						<div className="py-12 flex flex-col items-center gap-2 text-muted-foreground">
							<Send size={18} className="opacity-40" />
							<span className="text-xs">No emails sent yet</span>
						</div>
					) : (
						<div className="divide-y divide-border">
							{logs.map((log) => (
								<div className="flex items-start gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
									<div className="mt-0.5 flex-shrink-0">
										{log.status === "sent" ? (
											<CheckCircle2 size={13} className="text-emerald-500" />
										) : (
											<XCircle size={13} className="text-destructive" />
										)}
									</div>
									<div className="min-w-0 flex-1">
										<p className="text-[13px] text-foreground truncate leading-tight">
											{log.subject || "(no subject)"}
										</p>
										<p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
											{log.to_address}
										</p>
										{log.error && (
											<p className="text-[11px] text-destructive/80 truncate mt-0.5">
												{log.error}
											</p>
										)}
									</div>
									<Badge
										variant="outline"
										className="text-[10px] text-muted-foreground/50 whitespace-nowrap flex-shrink-0 mt-0.5 border-0 px-0"
									>
										{timeAgo(log.sent_at)}
									</Badge>
								</div>
							))}
						</div>
					)}
				</Card>
			</div>
		</div>
	);
}
