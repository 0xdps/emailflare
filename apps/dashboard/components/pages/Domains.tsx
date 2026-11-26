"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2, ExternalLink, Globe, Copy } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { verifyDomainAction, deleteDomainAction, getDomainHealthAction } from "@/app/actions/domains";
import EnableDomainDialog, { type EnableTarget } from "@/components/modules/domains/EnableDomainDialog";
import HealthChips from "@/components/modules/domains/HealthChips";
import { REMOVE_DOMAIN_NOTE, defaultSendingName } from "@/components/modules/domains/copy";
import type { DomainHealth } from "@/lib/core/domain-health";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader, PageShell } from "@/components/app/PageHeader";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";

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
	const [dnsModal, setDnsModal] = useState<{
		domain: Domain;
		records: DnsRecord[];
	} | null>(null);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [health, setHealth] = useState<Map<string, DomainHealth> | null>(null);
	const [healthError, setHealthError] = useState(false);

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

	async function handleDns(domain: Domain) {
		const { data } = await api.get<DnsRecord[]>(`/api/domains/${domain.id}/dns`);
		setDnsModal({ domain, records: data });
	}

	async function confirmDelete() {
		if (!deleteId) return;
		await deleteDomainAction(deleteId);
		setDeleteId(null);
		await load();
		void loadHealth(true);
	}

	function handleCopy(text: string, label: string) {
		navigator.clipboard.writeText(text).then(
			() => toast.success(`${label} copied`),
			() => toast.error("Could not copy to clipboard"),
		);
	}

	return (
		<PageShell>
			{/* Delete Confirm Dialog */}
			<Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Remove domain from EmailFlare?</DialogTitle>
						<DialogDescription>{REMOVE_DOMAIN_NOTE}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteId(null)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={confirmDelete}>
							Remove domain
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

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

			<Card className="gap-0 overflow-hidden py-0">
				<div className="border-b border-border bg-muted/20 px-5 py-3.5">
					<span className="text-sm font-semibold">Cloudflare zones</span>
				</div>
				{catalog.length === 0 ? (
					<p className="p-5 text-xs text-muted-foreground">No active zones were returned for this token.</p>
				) : (
					<div className="divide-y divide-border">
						{catalog.map((zone) => (
							<div key={zone.zoneName} className="flex items-center justify-between gap-3 p-4">
								<div>
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
					<Button variant="ghost" size="xs" onClick={() => void loadHealth(true)}>
						<RefreshCw />
						<span>Re-check all</span>
					</Button>
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
						{domains.map((d) => (
							<div
								key={d.id}
								className="flex flex-col justify-between gap-3 p-4 transition-colors hover:bg-muted/30 md:flex-row md:items-center md:px-5"
							>
								<div className="min-w-0 space-y-1.5">
									<div className="flex flex-wrap items-center gap-2">
										<span className="font-mono text-sm font-semibold text-foreground">
											{d.name}
										</span>
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
								</div>

								<div className="flex shrink-0 items-center gap-2">
									<Button variant="outline" size="sm" onClick={() => handleDns(d)}>
										<ExternalLink />
										<span>DNS Records</span>
									</Button>

									<Button
										variant="outline"
										size="sm"
										onClick={() => handleVerify(d)}
										disabled={verifying === d.id}
									>
										<RefreshCw className={verifying === d.id ? "animate-spin" : ""} />
										<span>{verifying === d.id ? "Checking…" : "Re-check"}</span>
									</Button>

									<Button
										variant="ghost"
										size="icon-sm"
										aria-label="Remove domain"
										onClick={() => setDeleteId(d.id)}
										className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
									>
										<Trash2 />
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</Card>

			{/* DNS Records Modal */}
			<Dialog open={!!dnsModal} onOpenChange={(open) => !open && setDnsModal(null)}>
				<DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
					<DialogHeader>
						<div className="flex items-center gap-2">
							<DialogTitle>DNS Configuration Records</DialogTitle>
							{dnsModal?.domain.verified ? (
								<Badge variant="success">VERIFIED</Badge>
							) : (
								<Badge variant="secondary">CONFIGURED</Badge>
							)}
						</div>
						<DialogDescription>
							{dnsModal?.domain.verified ? (
								<>
									Active DNS configuration records for{" "}
									<strong className="font-mono text-foreground">{dnsModal?.domain.name}</strong>.
									These records are already configured in Cloudflare.
								</>
							) : (
								<>
									DNS configuration records for{" "}
									<strong className="font-mono text-foreground">{dnsModal?.domain.name}</strong>.
									Cloudflare will verify them once propagation completes.
								</>
							)}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-3 pt-2">
						{dnsModal?.records.map((r, i) => (
							<div
								key={i}
								className="space-y-2 rounded-xl border border-border bg-muted/20 p-3.5 text-xs"
							>
								<div className="flex items-center justify-between">
									<Badge variant="soft" className="font-mono font-bold">
										{r.type}
									</Badge>
									<span className="text-2xs text-muted-foreground">TTL: {r.ttl || "Auto"}</span>
								</div>

								<div className="space-y-1">
									<div className="flex items-center justify-between text-2xs text-muted-foreground">
										<span>Hostname / Name</span>
										<Button
											type="button"
											variant="ghost"
											size="xs"
											className="text-primary"
											onClick={() => handleCopy(r.name, "Hostname")}
										>
											<Copy />
											<span>Copy</span>
										</Button>
									</div>
									<div className="rounded border border-border bg-background p-2 font-mono text-xs break-all text-foreground select-all">
										{r.name}
									</div>
								</div>

								<div className="space-y-1">
									<div className="flex items-center justify-between text-2xs text-muted-foreground">
										<span>Value / Target</span>
										<Button
											type="button"
											variant="ghost"
											size="xs"
											className="text-primary"
											onClick={() => handleCopy(r.content, "Value")}
										>
											<Copy />
											<span>Copy</span>
										</Button>
									</div>
									<div className="rounded border border-border bg-background p-2 font-mono text-xs break-all text-foreground select-all">
										{r.content}
									</div>
								</div>
							</div>
						))}
					</div>
				</DialogContent>
			</Dialog>
		</PageShell>
	);
}
