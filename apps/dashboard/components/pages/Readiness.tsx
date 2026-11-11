"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { enableSetupDomain, getReadiness, type Readiness } from "@/app/actions/setup";
import AppLogo from "@/components/AppLogo";
import { Button } from "@/components/ui/button";
import type { CatalogZone } from "@/components/pages/Domains";

const STEPS = ["Account", "Infrastructure", "Domain", "Launch"];
const SCOPES = ["Zone Read", "DNS Write", "Email Sending", "Email Routing"];

export default function ReadinessPage({
	initialReadiness = null,
	initialCatalog = [],
	catalogError = null,
	adminUser,
}: {
	initialReadiness?: Readiness | null;
	initialCatalog?: CatalogZone[];
	catalogError?: string | null;
	adminUser?: { name: string; email: string };
} = {}) {
	const [status, setStatus] = useState<Readiness | null>(initialReadiness);
	const [zones, setZones] = useState<CatalogZone[]>(initialCatalog);
	const [error, setError] = useState<string | null>(catalogError);
	const [busy, setBusy] = useState<string | null>(null);
	const [phase, setPhase] = useState<string | null>(null);
	const [useSubdomain, setUseSubdomain] = useState(true);
	const [checking, setChecking] = useState(false);

	const ready = (status?.domains ?? 0) > 0;
	const step = !status?.token.active ? 1 : ready ? 3 : 2;
	const sendingName = status?.readyDomain;

	async function recheck() {
		setChecking(true);
		setError(null);
		try {
			const [next, catalog] = await Promise.all([
				getReadiness(),
				api.get<{ zones: CatalogZone[] }>("/api/domains/catalog").then((res) => res.data.zones),
			]);
			setStatus(next);
			setZones(catalog);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Could not recheck the token.");
		} finally {
			setChecking(false);
		}
	}

	async function enable(zone: CatalogZone) {
		const name = useSubdomain ? `mail.${zone.zoneName}` : zone.zoneName;
		setBusy(zone.zoneName);
		setError(null);
		const phases = ["Resolving zone", "Creating sending name", "Publishing DNS", "Checking routing"];
		let index = 0;
		setPhase(phases[0]);
		const timer = setInterval(() => {
			index = Math.min(phases.length - 1, index + 1);
			setPhase(phases[index]);
		}, 700);
		try {
			await enableSetupDomain(zone.zoneName, name);
			await recheck();
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Could not enable domain");
		} finally {
			clearInterval(timer);
			setPhase(null);
			setBusy(null);
		}
	}

	if (!status) {
		return (
			<div className="min-h-screen grid place-items-center bg-background px-6">
				<div className="w-full max-w-md space-y-3">
					<div className="h-4 w-28 rounded bg-muted" />
					<div className="h-24 rounded-xl border bg-card" />
					<div className="h-40 rounded-xl border bg-card" />
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background px-6 py-10">
			<div className="mx-auto max-w-xl space-y-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<AppLogo size={26} />
						<span className="text-sm font-semibold">EmailFlare</span>
					</div>
					<p className="text-xs text-muted-foreground">{adminUser?.email}</p>
				</div>

				<ol className="grid grid-cols-4 gap-2">
					{STEPS.map((label, index) => (
						<li key={label} className="space-y-1">
							<div className={`h-1 rounded-full ${index <= step ? "bg-orange-500" : "bg-muted"}`} />
							<p className="text-[11px] text-muted-foreground">
								{index < step ? "Done" : index === step ? "Now" : "Next"} · {label}
							</p>
						</li>
					))}
				</ol>

				<section className="rounded-xl border p-4">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-sm font-medium">Cloudflare token</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{status.token.accountName ?? "Account not verified"}
								{status.token.accountId ? ` · ${status.token.accountId}` : ""}
							</p>
						</div>
						<span className={`text-xs ${status.token.active ? "text-emerald-600" : "text-destructive"}`}>
							{status.token.active ? "Active" : "Needs attention"}
						</span>
					</div>
					<p className="mt-2 text-xs text-muted-foreground">{status.token.message}</p>
					<ul className="mt-3 grid grid-cols-2 gap-1.5">
						{SCOPES.map((scope) => (
							<li key={scope} className="flex items-center gap-1.5 text-xs">
								<Check
									size={12}
									className={status.token.active ? "text-emerald-600" : "text-muted-foreground"}
								/>
								{scope}
							</li>
						))}
					</ul>
					{!status.token.active && (
						<div className="mt-3 flex flex-wrap gap-2">
							<a
								href="https://dash.cloudflare.com/profile/api-tokens"
								target="_blank"
								rel="noreferrer"
								className="inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs"
							>
								Open API tokens <ExternalLink size={12} />
							</a>
							<Button size="sm" variant="outline" disabled={checking} onClick={() => void recheck()}>
								{checking ? "Checking…" : "Re-test connection"}
							</Button>
						</div>
					)}
				</section>

				{!ready ? (
					<section className="rounded-xl border p-4 space-y-3">
						<div className="flex items-center justify-between">
							<p className="text-sm font-medium">Sending domain</p>
							<label className="flex items-center gap-2 text-xs">
								<input
									type="checkbox"
									checked={useSubdomain}
									onChange={(e) => setUseSubdomain(e.target.checked)}
								/>
								Use mail. subdomain
							</label>
						</div>
						<p className="text-xs text-muted-foreground">
							A subdomain keeps sending reputation off the apex domain.
						</p>
						{zones.length === 0 ? (
							<p className="text-xs text-muted-foreground">
								No zones yet. Add one in Cloudflare, then re-test.
							</p>
						) : (
							zones.map((zone) => (
								<div key={zone.zoneName} className="flex items-center justify-between gap-3">
									<div>
										<p className="font-mono text-xs">
											{useSubdomain ? `mail.${zone.zoneName}` : zone.zoneName}
										</p>
										<p className="text-[11px] text-muted-foreground">{zone.zoneName}</p>
									</div>
									<Button
										size="sm"
										disabled={!!busy || !status.token.active}
										onClick={() => void enable(zone)}
									>
										{busy === zone.zoneName ? (phase ?? "Enabling…") : "Enable"}
									</Button>
								</div>
							))
						)}
						{phase && (
							<p className="flex items-center gap-2 text-xs text-muted-foreground">
								<Loader2 size={12} className="animate-spin" /> {phase}
							</p>
						)}
					</section>
				) : (
					<section className="rounded-xl border p-4 space-y-4">
						<p className="text-sm font-medium">Workspace ready</p>
						<p className="text-xs text-emerald-700">
							{sendingName ?? "Domain"} is enabled. Send a test before inviting the team.
						</p>
						<div className="grid gap-2 sm:grid-cols-2">
							<Link
								href={`/developer/playground?from=${encodeURIComponent(`hello@${sendingName ?? ""}`)}&to=${encodeURIComponent(adminUser?.email ?? "")}`}
								className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm text-primary-foreground"
							>
								Send first email
							</Link>
							<Link
								href="/inbox"
								className="inline-flex h-8 items-center justify-center rounded-lg border px-2.5 text-sm"
							>
								Open inbox
							</Link>
							<Link
								href="/keys"
								className="inline-flex h-8 items-center justify-center rounded-lg border px-2.5 text-sm"
							>
								Generate API key
							</Link>
							<Link
								href="/settings/users"
								className="inline-flex h-8 items-center justify-center rounded-lg border px-2.5 text-sm"
							>
								Invite team
							</Link>
						</div>
					</section>
				)}

				{error && <p className="text-xs text-destructive">{error}</p>}
			</div>
		</div>
	);
}
