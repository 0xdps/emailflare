"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";
import { enableSetupDomain, getReadiness, type Readiness } from "@/app/actions/setup";
import { Button } from "@/components/ui/button";

interface Zone {
	zoneName: string;
	enabled: boolean;
	sendingName: string | null;
	sending: "ready" | "pending" | "off";
}

export default function ReadinessPage() {
	const [status, setStatus] = useState<Readiness | null>(null);
	const [zones, setZones] = useState<Zone[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState<string | null>(null);

	async function load() {
		const [ready, catalog] = await Promise.all([
			getReadiness(),
			api
				.get<{ zones: Zone[] }>("/api/domains/catalog")
				.then((res) => res.data.zones)
				.catch(() => []),
		]);
		setStatus(ready);
		setZones(catalog);
	}

	useEffect(() => {
		load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load setup"));
	}, []);

	async function enable(zone: Zone) {
		setBusy(zone.zoneName);
		setError(null);
		try {
			const name = zone.sending && zone.sending !== "off" && zone.sendingName ? zone.sendingName : zone.zoneName;
			await enableSetupDomain(zone.zoneName, name);
			await load();
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Could not enable domain");
		} finally {
			setBusy(null);
		}
	}

	if (!status) {
		return (
			<div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
				<Loader2 className="animate-spin" size={16} />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background px-6 py-12">
			<div className="mx-auto max-w-xl space-y-6">
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-widest text-orange-500">Setup</p>
					<h1 className="mt-2 text-2xl font-semibold tracking-tight">Enable a domain</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Pick a zone the token can already see. Mailboxes and API keys are in Workspace.
					</p>
				</div>

				<section className="rounded-xl border p-4">
					<p className="text-sm font-medium">Cloudflare token</p>
					<p className="mt-1 text-xs text-muted-foreground">{status.token.message}</p>
					{!status.token.active && (
						<p className="mt-2 text-xs text-destructive">
							Required scopes: Zone Read, DNS Write, Email Sending, Email Routing.
						</p>
					)}
				</section>

				<section className="rounded-xl border p-4 space-y-3">
					<p className="text-sm font-medium">Domains</p>
					{zones.length === 0 ? (
						<p className="text-xs text-muted-foreground">
							No zones yet. Add one in Cloudflare, then refresh.
						</p>
					) : (
						zones.map((zone) => (
							<div key={zone.zoneName} className="flex items-center justify-between gap-3">
								<span className="font-mono text-xs">{zone.zoneName}</span>
								{zone.enabled ? (
									<span className="text-xs text-emerald-600">Enabled</span>
								) : (
									<Button size="sm" disabled={busy === zone.zoneName} onClick={() => enable(zone)}>
										Enable
									</Button>
								)}
							</div>
						))
					)}
				</section>

				{error && <p className="text-xs text-destructive">{error}</p>}

				<Button
					disabled={status.domains === 0}
					onClick={() => {
						window.location.href = "/settings";
					}}
				>
					Continue to Workspace
				</Button>
			</div>
		</div>
	);
}
