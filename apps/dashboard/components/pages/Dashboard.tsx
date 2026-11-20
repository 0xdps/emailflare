"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RefreshCw, TrendingUp, AlertTriangle, Mail, Activity, FlaskConical, Key, Send } from "lucide-react";
import api from "@/lib/api";
import { PageHeader, PageShell } from "@/components/app/PageHeader";
import { StatCard, TONE_STYLES, type Tone } from "@/components/app/StatCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

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

const chartConfig = {
	sent: { label: "Sent", color: "var(--chart-1)" },
	failed: { label: "Failed", color: "var(--destructive)" },
} satisfies ChartConfig;

function VolumeChart({ daily }: { daily: DailyBucket[] }) {
	if (!daily.length) {
		return (
			<Empty className="h-44">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<TrendingUp />
					</EmptyMedia>
					<EmptyTitle className="text-xs font-normal text-muted-foreground">
						No data for this period
					</EmptyTitle>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<ChartContainer config={chartConfig} className="h-52 w-full">
			<AreaChart data={daily} margin={{ left: 4, right: 4, top: 8 }}>
				<defs>
					<linearGradient id="fillSent" x1="0" y1="0" x2="0" y2="1">
						<stop offset="5%" stopColor="var(--color-sent)" stopOpacity={0.3} />
						<stop offset="95%" stopColor="var(--color-sent)" stopOpacity={0} />
					</linearGradient>
				</defs>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="date"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={32}
					tickFormatter={shortDate}
				/>
				<YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} tickFormatter={fmt} />
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent labelFormatter={(value) => shortDate(String(value))} indicator="line" />
					}
				/>
				<Area dataKey="sent" type="monotone" fill="url(#fillSent)" stroke="var(--color-sent)" strokeWidth={2} />
				<Area dataKey="failed" type="monotone" fill="none" stroke="var(--color-failed)" strokeWidth={1.5} />
			</AreaChart>
		</ChartContainer>
	);
}

// ─── Page Skeleton ────────────────────────────────────────────────────────────

function DashboardSkeleton() {
	return (
		<PageShell width="wide">
			<div className="flex items-center justify-between">
				<div className="flex flex-col gap-1.5">
					<Skeleton className="h-7 w-32" />
					<Skeleton className="h-4 w-48" />
				</div>
				<div className="flex gap-2">
					<Skeleton className="h-8 w-28" />
					<Skeleton className="size-8" />
				</div>
			</div>
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				{[...Array(4)].map((_, i) => (
					<Skeleton key={i} className="h-28 rounded-xl" />
				))}
			</div>
			<Skeleton className="h-64 rounded-xl" />
		</PageShell>
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
	const rateTone: Tone =
		deliveryRate === null ? "neutral" : deliveryRate >= 95 ? "success" : deliveryRate >= 80 ? "warning" : "danger";
	const rateBadge = {
		neutral: "secondary",
		success: "success",
		warning: "warning",
		danger: "destructive",
	} as const;
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

	const quotaTone: Tone = limitPct >= 90 ? "danger" : limitPct >= 70 ? "warning" : "brand";
	const quotaBar =
		limitPct >= 90
			? "[&_[data-slot=progress-indicator]]:bg-destructive"
			: limitPct >= 70
				? "[&_[data-slot=progress-indicator]]:bg-warning"
				: "[&_[data-slot=progress-indicator]]:bg-primary";

	return (
		<PageShell width="wide">
			<PageHeader
				title="Dashboard"
				description={new Date().toLocaleDateString("en-US", {
					weekday: "long",
					month: "long",
					day: "numeric",
					year: "numeric",
				})}
				actions={
					<>
						<ToggleGroup
							value={[range]}
							onValueChange={(v) => v[0] && setRange(v[0] as Range)}
							variant="outline"
							size="sm"
							spacing={0}
						>
							{RANGES.map((r) => (
								<ToggleGroupItem key={r} value={r} className="font-semibold">
									{r}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
						<Button
							variant="outline"
							size="icon"
							onClick={() => load(range)}
							disabled={refreshing}
							aria-label="Refresh"
						>
							<RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
						</Button>
					</>
				}
			/>

			{stats.totalEmails === 0 && (
				<Alert variant="info">
					<AlertDescription className="text-info-muted-foreground">
						No mail sent yet.{" "}
						<Link href="/developer/playground" className="font-medium underline">
							Send a test from the playground
						</Link>{" "}
						or{" "}
						<Link href="/keys" className="font-medium underline">
							create an API key
						</Link>
						.
					</AlertDescription>
				</Alert>
			)}

			{/* ── Transactional Send API Quickstart ───────────────────────────────── */}
			<Card className="bg-linear-to-r from-primary-muted/60 to-transparent">
				<CardContent className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<span className="text-xs font-semibold text-foreground">Transactional Send API</span>
							<Badge variant="outline" className="font-mono text-2xs">
								POST /v1/send
							</Badge>
						</div>
						<p className="text-xs text-muted-foreground">
							Dispatch emails via HTTP API or test with sandbox isolation in the interactive Playground.
						</p>
					</div>
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						<Button variant="outline" size="sm" render={<Link href="/developer/playground" />}>
							<FlaskConical className="text-primary" />
							<span>Playground</span>
						</Button>
						<Button variant="outline" size="sm" render={<Link href="/keys" />}>
							<Key className="text-primary" />
							<span>API keys</span>
						</Button>
						<Button variant="outline" size="sm" render={<Link href="/developer/logs" />}>
							<Activity className="text-info" />
							<span>Logs</span>
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* ── KPI tiles ──────────────────────────────────────────────────────── */}
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<StatCard
					label="Sent today"
					icon={Send}
					tone="brand"
					value={fmt(stats.sentToday)}
					footer={
						stats.failedToday > 0 ? (
							<span className="text-destructive">{stats.failedToday} failed</span>
						) : (
							<span className="text-success">&#10003; All delivered</span>
						)
					}
				/>

				<StatCard
					label="All-time"
					icon={Mail}
					tone="info"
					value={fmt(stats.totalEmails)}
					footer="emails delivered"
				/>

				<StatCard
					label="Delivery rate"
					icon={Activity}
					tone={rateTone}
					value={
						<span className={TONE_STYLES[rateTone].text}>
							{deliveryPct}
							{deliveryRate !== null ? "%" : ""}
						</span>
					}
					footer={
						<Badge variant={rateBadge[rateTone]}>
							{deliveryRate !== null && deliveryRate < 95 && <AlertTriangle />}
							{rateLabel}
						</Badge>
					}
				/>

				<StatCard
					label="Daily quota"
					icon={TrendingUp}
					tone={quotaTone}
					value={fmt(Math.max(0, limitRemaining))}
					footer={
						<div className="space-y-2">
							<p>
								{fmt(stats.sentToday)} sent · {fmt(stats.cfDailyLimit)} daily limit
							</p>
							<Progress value={limitPct} className={cn("gap-0", quotaBar)} />
							<p className="text-2xs">{limitPct.toFixed(1)}% used</p>
						</div>
					}
				/>
			</div>

			{/* ── Volume chart ────────────────────────────────────────────────────── */}
			<Card>
				<CardContent>
					<div className="mb-4 flex items-center justify-between">
						<div>
							<p className="text-sm font-medium">Email volume</p>
							<p className="mt-0.5 text-xs text-muted-foreground">
								{stats.daily.reduce((a, d) => a + d.sent, 0).toLocaleString()} sent ·{" "}
								{range === "1d" ? "past 24h" : range === "7d" ? "past 7 days" : "past 30 days"}
							</p>
						</div>
						<div className="flex items-center gap-3 text-2xs text-muted-foreground">
							<span className="flex items-center gap-1.5">
								<span className="inline-block h-0.5 w-3 rounded bg-primary" />
								Sent
							</span>
							<span className="flex items-center gap-1.5">
								<span className="inline-block h-0.5 w-3 rounded bg-destructive" />
								Failed
							</span>
						</div>
					</div>
					<VolumeChart daily={stats.daily} />
				</CardContent>
			</Card>
		</PageShell>
	);
}
