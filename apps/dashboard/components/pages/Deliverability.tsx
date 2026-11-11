"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

interface Stats {
	sentToday: number;
	failedToday: number;
	domainBreakdown: { name: string; verified: boolean; sent: number; failed: number }[];
}

export default function DeliverabilityPage() {
	const [stats, setStats] = useState<Stats | null>(null);
	const [suppressions, setSuppressions] = useState(0);

	useEffect(() => {
		Promise.all([api.get<Stats>("/api/stats?range=30d"), api.get<{ total: number }>("/api/suppressions?limit=1")])
			.then(([statsRes, suppressionRes]) => {
				setStats(statsRes.data);
				setSuppressions(suppressionRes.data.total);
			})
			.catch(() => setStats(null));
	}, []);

	const sent = stats?.domainBreakdown.reduce((sum, row) => sum + row.sent, 0) ?? 0;
	const failed = stats?.domainBreakdown.reduce((sum, row) => sum + row.failed, 0) ?? 0;
	const score = sent + failed === 0 ? null : Math.round((sent / (sent + failed)) * 100);

	return (
		<div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8">
			<div>
				<p className="text-xs uppercase tracking-wider text-muted-foreground">Delivery</p>
				<h1 className="text-2xl font-semibold">Deliverability</h1>
			</div>
			<div className="grid gap-3 sm:grid-cols-3">
				<div className="rounded-xl border p-4">
					<p className="text-xs text-muted-foreground">30-day delivery</p>
					<p className="mt-1 text-2xl font-semibold tabular-nums">{score === null ? "—" : `${score}%`}</p>
				</div>
				<div className="rounded-xl border p-4">
					<p className="text-xs text-muted-foreground">Failed today</p>
					<p className="mt-1 text-2xl font-semibold tabular-nums">{stats?.failedToday ?? "—"}</p>
				</div>
				<div className="rounded-xl border p-4">
					<p className="text-xs text-muted-foreground">Suppressed addresses</p>
					<p className="mt-1 text-2xl font-semibold tabular-nums">{suppressions}</p>
				</div>
			</div>
			<div className="divide-y rounded-xl border">
				{(stats?.domainBreakdown ?? []).map((domain) => (
					<div key={domain.name} className="flex items-center justify-between px-4 py-3 text-xs">
						<span className="font-mono">{domain.name}</span>
						<span className="text-muted-foreground">
							{domain.verified ? "DKIM ready" : "DNS pending"} · {domain.sent} sent · {domain.failed}{" "}
							failed
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
