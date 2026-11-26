"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Plus, RefreshCw, Search, Settings2, Globe } from "lucide-react";
import api from "@/lib/api";
import { verifyDomainAction, getDomainHealthAction } from "@/app/actions/domains";
import BulkEnableDialog from "@/components/modules/domains/BulkEnableDialog";
import EnableDomainDialog, { type EnableTarget } from "@/components/modules/domains/EnableDomainDialog";
import HealthChips from "@/components/modules/domains/HealthChips";
import { defaultSendingName } from "@/components/modules/domains/copy";
import { issuesOf, type DomainHealth } from "@/lib/core/domain-health";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader, PageShell } from "@/components/app/PageHeader";

export interface Domain {
	id: string;
	name: string;
	cf_zone_id: string;
	cf_subdomain_id: string | null;
	verified: number;
	dkim_selector: string | null;
	return_path_domain: string | null;
	created_at: string;
}

export interface DnsRecord {
	type: string;
	name: string;
	content: string;
	ttl: number;
	required: boolean;
}

export interface CatalogZone {
	zoneName: string;
	enabled: boolean;
	domainId: string | null;
	sendingName: string | null;
	sending: "ready" | "pending" | "off";
	routing: "ready" | "pending" | "unknown";
	dns: "written" | "manual" | "unknown";
}

export interface DomainsPageProps {
	initialDomains?: Domain[];
	initialCatalog?: CatalogZone[];
	catalogError?: string | null;
}

export default function DomainsPage({ initialDomains, initialCatalog, catalogError }: DomainsPageProps = {}) {
	const [domains, setDomains] = useState<Domain[]>(initialDomains ?? []);
	const [catalog, setCatalog] = useState<CatalogZone[]>(initialCatalog ?? []);
	const [catalogNote, setCatalogNote] = useState<string | null>(catalogError ?? null);
	const [loading, setLoading] = useState(!initialDomains);
	const [manual, setManual] = useState(false);
	const [form, setForm] = useState({ name: "", zoneName: "" });
	const [enableTarget, setEnableTarget] = useState<EnableTarget | null>(null);
	const [verifying, setVerifying] = useState<string | null>(null);
	const [health, setHealth] = useState<Map<string, DomainHealth> | null>(null);
	const [healthError, setHealthError] = useState(false);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [bulkZones, setBulkZones] = useState<string[] | null>(null);
	const [query, setQuery] = useState("");
	const [onlyAttention, setOnlyAttention] = useState(false);

	// Health is asked of Cloudflare, so it loads after the list instead of delaying it.
	async function loadHealth(fresh = false) {
		setHealthError(false);
		try {
			const rows = await getDomainHealthAction({ fresh });
			setHealth(new Map(rows.map((row) => [row.id, row])));
		} catch {
			setHealthError(true);
		}
	}

	async function load() {
		setLoading(true);
		try {
			const { data } = await api.get<Domain[]>("/api/domains");
			setDomains(data);
		} catch {
			setDomains([]);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		if (!initialDomains) {
			load();
		}
	}, [initialDomains]);

	useEffect(() => {
		void loadHealth();
	}, []);

	function startEnable(zone: CatalogZone) {
		setEnableTarget({
			zoneName: zone.zoneName,
			sendingName:
				zone.sendingName && zone.sending !== "off" ? zone.sendingName : defaultSendingName(zone.zoneName),
		});
	}

	// The dialog saved a domain: refresh everything that depends on it.
	async function handleEnabled() {
		await load();
		void loadHealth(true);
	}

	async function handleVerify(domain: Domain) {
		setVerifying(domain.id);
		try {
			const res = await verifyDomainAction(domain.id);
			if (res.verified) {
				setDomains((prev) => prev.map((d) => (d.id === domain.id ? { ...d, verified: 1 } : d)));
			}
			await loadHealth(true);
		} finally {
			setVerifying(null);
		}
	}

	const setupZones = catalog.filter((zone) => !zone.enabled);
	const attention = new Map(
		domains.flatMap((d) => {
			const h = health?.get(d.id);
			const issues = h ? issuesOf(h) : [];
			return issues.length ? [[d.id, issues] as const] : [];
		}),
	);
	const visible = domains.filter(
		(d) => d.name.toLowerCase().includes(query.trim().toLowerCase()) && (!onlyAttention || attention.has(d.id)),
	);

	function toggleZone(zoneName: string, on: boolean) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (on) next.add(zoneName);
			else next.delete(zoneName);
			return next;
		});
	}

	return (
		<PageShell>
			<BulkEnableDialog
				zones={bulkZones}
				onClose={() => {
					setBulkZones(null);
					setSelected(new Set());
				}}
				onFinished={() => void handleEnabled()}
			/>
			<EnableDomainDialog
				target={enableTarget}
				onClose={() => setEnableTarget(null)}
				onFinished={() => void handleEnabled()}
			/>

			<PageHeader
				eyebrow="DNS & Delivery"
				title="Domains"
				description="Enable a Cloudflare domain to send and receive mail. Each row shows what the domain can do right now."
				actions={
					<Button variant="outline" onClick={() => setManual((open) => !open)}>
						<Plus />
						<span>Domain not listed?</span>
					</Button>
				}
			/>

			{catalogNote && (
				<Alert variant="destructive">
					<AlertDescription>{catalogNote}</AlertDescription>
				</Alert>
			)}

			{attention.size > 0 && !onlyAttention && (
				<Alert variant="warning">
					<AlertTriangle />
					<AlertDescription className="flex flex-wrap items-center justify-between gap-2">
						<span>
							{attention.size} {attention.size === 1 ? "domain needs" : "domains need"} attention.
							Something changed in Cloudflare, or setup did not finish.
						</span>
						<Button size="xs" variant="outline" onClick={() => setOnlyAttention(true)}>
							Show them
						</Button>
					</AlertDescription>
				</Alert>
			)}

			<Card className="gap-0 overflow-hidden py-0">
				<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/20 px-5 py-3.5">
					<span className="text-sm font-semibold">Cloudflare zones</span>
					{setupZones.length > 0 && (
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="xs"
								onClick={() =>
									setSelected(
										selected.size === setupZones.length
											? new Set()
											: new Set(setupZones.map((zone) => zone.zoneName)),
									)
								}
							>
								{selected.size === setupZones.length
									? "Clear selection"
									: `Select all ${setupZones.length}`}
							</Button>
							<Button
								size="xs"
								disabled={selected.size === 0}
								onClick={() => setBulkZones([...selected])}
							>
								Set up {selected.size || ""} selected
							</Button>
						</div>
					)}
				</div>
				{catalog.length === 0 ? (
					<p className="p-5 text-xs text-muted-foreground">No active zones were returned for this token.</p>
				) : (
					<div className="divide-y divide-border">
						{catalog.map((zone) => (
							<div key={zone.zoneName} className="flex items-center gap-3 p-4">
								{!zone.enabled ? (
									<Checkbox
										checked={selected.has(zone.zoneName)}
										onCheckedChange={(checked) => toggleZone(zone.zoneName, checked === true)}
										aria-label={`Select ${zone.zoneName}`}
									/>
								) : (
									<span className="size-4" />
								)}
								<div className="flex-1">
									<p className="font-mono text-sm font-semibold">{zone.zoneName}</p>
									<p className="text-2xs text-muted-foreground">
										{zone.sending === "ready"
											? "Ready to send"
											: zone.sending === "pending"
												? "Sending needs DNS"
												: "Sending off"}
										{" · "}
										{zone.routing === "ready"
											? "Ready to receive"
											: zone.routing === "pending"
												? "Receiving needs setup"
												: "Receiving unknown"}
										{zone.sendingName ? ` · ${zone.sendingName}` : ""}
									</p>
								</div>
								{zone.enabled ? (
									<Badge variant="outline">Enabled</Badge>
								) : (
									<Button size="sm" onClick={() => startEnable(zone)}>
										Enable
									</Button>
								)}
							</div>
						))}
					</div>
				)}
			</Card>

			{manual && (
				<form
					className="space-y-3 rounded-xl border border-border p-4"
					onSubmit={(e) => {
						e.preventDefault();
						const zoneName = form.zoneName.trim();
						setEnableTarget({ zoneName, sendingName: form.name.trim() || defaultSendingName(zoneName) });
						setManual(false);
						setForm({ name: "", zoneName: "" });
					}}
				>
					<p className="text-xs text-muted-foreground">
						Only if the domain is missing from the list above. It must be an active zone in the Cloudflare
						account this token belongs to.
					</p>
					<Input
						value={form.zoneName}
						onChange={(e) => setForm({ ...form, zoneName: e.target.value.toLowerCase().trim() })}
						placeholder="Domain, e.g. acme.com"
						className="font-mono text-xs"
						required
					/>
					<Input
						value={form.name}
						onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().trim() })}
						placeholder="Send from (optional), defaults to mail.<domain>"
						className="font-mono text-xs"
					/>
					<Button type="submit">Review</Button>
				</form>
			)}

			{/* Domains Card */}
			<Card className="gap-0 overflow-hidden py-0">
				<div className="flex items-center justify-between border-b border-border bg-muted/20 px-5 py-3.5">
					<span className="text-sm font-semibold text-foreground">Configured Domains ({domains.length})</span>
					<div className="flex items-center gap-2">
						<InputGroup className="w-44">
							<InputGroupAddon>
								<Search />
							</InputGroupAddon>
							<InputGroupInput
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Search"
								aria-label="Search domains"
							/>
						</InputGroup>
						<Button
							variant={onlyAttention ? "default" : "outline"}
							size="xs"
							aria-pressed={onlyAttention}
							onClick={() => setOnlyAttention((v) => !v)}
						>
							Needs attention{attention.size ? ` (${attention.size})` : ""}
						</Button>
						<Button variant="ghost" size="xs" onClick={() => void loadHealth(true)}>
							<RefreshCw />
							<span>Re-check all</span>
						</Button>
					</div>
				</div>

				{loading ? (
					<div className="space-y-2 p-4">
						{[...Array(3)].map((_, i) => (
							<Skeleton key={i} className="h-16 rounded-lg" />
						))}
					</div>
				) : domains.length === 0 ? (
					<Empty className="py-16">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Globe />
							</EmptyMedia>
							<EmptyTitle>No domains configured yet</EmptyTitle>
							<EmptyDescription>
								Add a sending domain to unlock deliverability via Cloudflare.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<div className="divide-y divide-border">
						{visible.length === 0 && (
							<p className="p-5 text-xs text-muted-foreground">
								No domains match{onlyAttention ? " and need attention" : ""}.
							</p>
						)}
						{visible.map((d) => (
							<div
								key={d.id}
								className="flex flex-col justify-between gap-3 p-4 transition-colors hover:bg-muted/30 md:flex-row md:items-center md:px-5"
							>
								<div className="min-w-0 space-y-1.5">
									<div className="flex flex-wrap items-center gap-2">
										<Link
											href={`/domains/${d.id}`}
											className="font-mono text-sm font-semibold text-foreground hover:underline"
										>
											{d.name}
										</Link>
										{health?.get(d.id) && (
											<span className="text-2xs text-muted-foreground">
												{health.get(d.id)!.mailboxes}{" "}
												{health.get(d.id)!.mailboxes === 1 ? "mailbox" : "mailboxes"}
											</span>
										)}
									</div>
									{healthError ? (
										<p className="text-2xs text-muted-foreground">
											Could not check Cloudflare. Showing the last saved state.
										</p>
									) : (
										<HealthChips health={health?.get(d.id)} />
									)}
									{attention.get(d.id)?.map((issue) => (
										<p key={issue} className="text-2xs text-warning-muted-foreground">
											{issue}
										</p>
									))}
								</div>

								<div className="flex shrink-0 items-center gap-2">
									<Link
										href={`/domains/${d.id}`}
										className={buttonVariants({ variant: "outline", size: "sm" })}
									>
										<Settings2 />
										<span>Manage</span>
									</Link>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => handleVerify(d)}
										disabled={verifying === d.id}
									>
										<RefreshCw className={verifying === d.id ? "animate-spin" : ""} />
										<span>{verifying === d.id ? "Checking…" : "Re-check"}</span>
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</Card>
		</PageShell>
	);
}
