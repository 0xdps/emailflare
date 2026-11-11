"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

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

	useEffect(() => {
		api.get<{ data: AuditRow[] }>("/api/audit")
			.then((res) => setRows(res.data.data))
			.catch(() => setRows([]));
	}, []);

	return (
		<div className="mx-auto max-w-4xl space-y-4 p-6 md:p-8">
			<div>
				<p className="text-xs uppercase tracking-wider text-muted-foreground">Admin</p>
				<h1 className="text-2xl font-semibold">Audit log</h1>
			</div>
			<div className="overflow-hidden rounded-xl border">
				<table className="w-full text-left text-xs">
					<thead className="bg-muted/40 text-muted-foreground">
						<tr>
							<th className="px-4 py-2 font-medium">When</th>
							<th className="px-4 py-2 font-medium">Who</th>
							<th className="px-4 py-2 font-medium">Action</th>
							<th className="px-4 py-2 font-medium">Detail</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{rows.map((row) => (
							<tr key={row.id}>
								<td className="px-4 py-2 tabular-nums">{new Date(row.created_at).toLocaleString()}</td>
								<td className="px-4 py-2">{row.actor_email ?? "system"}</td>
								<td className="px-4 py-2 font-mono">{row.action}</td>
								<td className="px-4 py-2 text-muted-foreground">{row.detail}</td>
							</tr>
						))}
						{rows.length === 0 && (
							<tr>
								<td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
									No admin actions recorded yet.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
