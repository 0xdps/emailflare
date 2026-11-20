"use client";

import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PageShell } from "@/components/app/PageHeader";

interface AuditRow {
	id: string;
	action: string;
	target_type: string | null;
	detail: string | null;
	actor_email: string | null;
	created_at: string;
}

export default function AuditLogPage() {
	const [rows, setRows] = useState<AuditRow[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		api.get<{ data: AuditRow[] }>("/api/audit")
			.then((res) => setRows(res.data.data))
			.catch(() => setRows([]))
			.finally(() => setLoading(false));
	}, []);

	return (
		<PageShell width="default">
			<PageHeader eyebrow="Admin" title="Audit log" />
			<Card className="gap-0 py-0">
				{loading ? (
					<div className="space-y-2 p-4">
						{[...Array(5)].map((_, i) => (
							<Skeleton key={i} className="h-10 rounded-lg" />
						))}
					</div>
				) : rows.length === 0 ? (
					<Empty className="py-16">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<ScrollText />
							</EmptyMedia>
							<EmptyTitle>No admin actions recorded yet.</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<Table>
						<TableHeader>
							<TableRow className="bg-muted/10 hover:bg-muted/10">
								<TableHead className="px-4 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
									When
								</TableHead>
								<TableHead className="px-4 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
									Who
								</TableHead>
								<TableHead className="px-4 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
									Action
								</TableHead>
								<TableHead className="px-4 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
									Detail
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => (
								<TableRow key={row.id}>
									<TableCell className="px-4 py-2.5 text-xs tabular-nums">
										{new Date(row.created_at).toLocaleString()}
									</TableCell>
									<TableCell className="px-4 py-2.5 text-xs">{row.actor_email ?? "system"}</TableCell>
									<TableCell className="px-4 py-2.5 font-mono text-xs">{row.action}</TableCell>
									<TableCell className="px-4 py-2.5 text-xs whitespace-normal text-muted-foreground">
										{row.detail}
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
