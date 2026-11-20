"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Ban, Globe, ShieldCheck } from "lucide-react";
import api from "@/lib/api";
import { PageHeader, PageShell } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Stats {
	sentToday: number;
	failedToday: number;
	domainBreakdown: { name: string; verified: boolean; sent: number; failed: number }[];
}

export default function DeliverabilityPage() {
	const [stats, setStats] = useState<Stats | null>(null);
	const [suppressions, setSuppressions] = useState(0);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		Promise.all([api.get<Stats>("/api/stats?range=30d"), api.get<{ total: number }>("/api/suppressions?limit=1")])
			.then(([statsRes, suppressionRes]) => {
				setStats(statsRes.data);
				setSuppressions(suppressionRes.data.total);
			})
			.catch(() => setStats(null))
			.finally(() => setLoading(false));
	}, []);

	const sent = stats?.domainBreakdown.reduce((sum, row) => sum + row.sent, 0) ?? 0;
	const failed = stats?.domainBreakdown.reduce((sum, row) => sum + row.failed, 0) ?? 0;
	const score = sent + failed === 0 ? null : Math.round((sent / (sent + failed)) * 100);

	return (
		<PageShell width="narrow">
			<PageHeader eyebrow="Delivery" title="Deliverability" />
			<div className="grid gap-3 sm:grid-cols-3">
				<StatCard
					label="30-day delivery"
					icon={ShieldCheck}
					tone="success"
					loading={loading}
					value={score === null ? "—" : `${score}%`}
				/>
				<StatCard
					label="Failed today"
					icon={AlertTriangle}
					tone="danger"
					loading={loading}
					value={stats?.failedToday ?? "—"}
				/>
				<StatCard label="Suppressed addresses" icon={Ban} loading={loading} value={suppressions} />
			</div>
			<Card className="py-0">
				{loading ? (
					<div className="space-y-2 p-4">
						{[...Array(3)].map((_, i) => (
							<Skeleton key={i} className="h-8" />
						))}
					</div>
				) : !stats || stats.domainBreakdown.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Globe />
							</EmptyMedia>
							<EmptyTitle>No domain activity</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="px-4">Domain</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="text-right">Sent</TableHead>
								<TableHead className="px-4 text-right">Failed</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{stats.domainBreakdown.map((domain) => (
								<TableRow key={domain.name}>
									<TableCell className="px-4 font-mono text-xs">{domain.name}</TableCell>
									<TableCell>
										<Badge variant={domain.verified ? "success" : "warning"}>
											{domain.verified ? "DKIM ready" : "DNS pending"}
										</Badge>
									</TableCell>
									<TableCell className="text-right text-xs text-muted-foreground tabular-nums">
										{domain.sent} sent
									</TableCell>
									<TableCell className="px-4 text-right text-xs text-muted-foreground tabular-nums">
										{domain.failed} failed
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</Card>
		</PageShell>
	);
}
