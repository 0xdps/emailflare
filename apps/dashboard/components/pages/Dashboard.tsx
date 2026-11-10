"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RefreshCw, TrendingUp, AlertTriangle, Mail, Activity, FlaskConical, Key, Send } from "lucide-react";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DomainBreakdown {
	name: string;
	verified: boolean;
	sent: number;
	failed: number;
	bounces: number;
	complaints: number;
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

const RANGES = ["1d", "7d", "30d"] as const;
type Range = (typeof RANGES)[number];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
	return n.toLocaleString();
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
		</div>
	);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export interface DashboardProps {
	initialStats?: Stats | null;
}

export default function Dashboard({ initialStats }: DashboardProps = {}) {
	const [stats, setStats] = useState<Stats | null>(initialStats ?? null);
	const [refreshing, setRefreshing] = useState(false);
	const [range, setRange] = useState<Range>("7d");
	const isFirstMount = useRef(true);

	async function load(r: Range = range) {
		setRefreshing(true);
		try {
			const s = await api.get<Stats>(`/api/stats?range=${r}`);
			setStats(s.data);
		} finally {
			setRefreshing(false);
		}
	}

	useEffect(() => {
		if (isFirstMount.current) {
			isFirstMount.current = false;
			if (initialStats) return;
		}
		load(range);
	}, [range]); // eslint-disable-line react-hooks/exhaustive-deps

	if (!stats) return <DashboardSkeleton />;

	const totalToday = stats.sentToday + stats.failedToday;
	const deliveryRate = totalToday > 0 ? (stats.sentToday / totalToday) * 100 : null;
	const deliveryPct = deliveryRate === null ? "—" : deliveryRate.toFixed(1);
	const rateColor =
		deliveryRate === null ? "#71717a" : deliveryRate >= 95 ? "#10b981" : deliveryRate >= 80 ? "#f59e0b" : "#ef4444";
	const rateLabel =
		deliveryRate === null
			? "No sends"
			: deliveryRate >= 95
				? "Healthy"
				: deliveryRate >= 80
					? "Degraded"
					: "Critical";

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

			{/* ── Transactional Send API Quickstart ───────────────────────────────── */}
			<div className="rounded-xl border border-border bg-gradient-to-r from-orange-500/5 via-purple-500/5 to-transparent p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<span className="text-xs font-semibold text-foreground">Transactional Send API</span>
						<span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border">
							POST /v1/send
						</span>
					</div>
					<p className="text-xs text-muted-foreground">
						Dispatch emails via HTTP API or test with sandbox isolation in the interactive Playground.
					</p>
				</div>
				<div className="flex items-center gap-2 shrink-0 flex-wrap">
					<Link
						href="/developer/playground"
						className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium transition-colors"
					>
						<FlaskConical size={13} className="text-purple-600 dark:text-purple-400" />
						<span>Playground</span>
					</Link>
					<Link
						href="/keys"
						className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium transition-colors"
					>
						<Key size={13} className="text-orange-500" />
						<span>API keys</span>
					</Link>
					<Link
						href="/developer/logs"
						className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium transition-colors"
					>
						<Activity size={13} className="text-blue-500" />
						<span>Logs</span>
					</Link>
				</div>
			</div>

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
						{deliveryPct}
						{deliveryRate !== null ? "%" : ""}
					</p>
					<div className="mt-2">
						<span
							className={cn(
								"inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md",
								deliveryRate === null
									? "bg-muted text-muted-foreground"
									: deliveryRate >= 95
										? "bg-emerald-50 text-emerald-700"
										: deliveryRate >= 80
											? "bg-amber-50 text-amber-700"
											: "bg-red-50 text-red-700",
							)}
						>
							{deliveryRate !== null && deliveryRate < 95 && <AlertTriangle size={9} />}
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
						{fmt(Math.max(0, limitRemaining))}
					</p>
					<p className="text-[11.5px] text-muted-foreground mt-2">
						{fmt(stats.sentToday)} sent · {fmt(stats.cfDailyLimit)} daily limit
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
		</div>
	);
}
