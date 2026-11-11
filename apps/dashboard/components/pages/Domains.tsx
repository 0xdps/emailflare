"use client";

import { useEffect, useState } from "react";
import {
	Plus,
	RefreshCw,
	Trash2,
	CheckCircle2,
	Clock,
	ExternalLink,
	Globe,
	X,
	ShieldCheck,
	ShieldOff,
	Loader2,
	Copy,
	Check,
	AlertCircle,
} from "lucide-react";
import api from "@/lib/api";
import { createDomainAction, verifyDomainAction, deleteDomainAction } from "@/app/actions/domains";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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
	const [sendingChoice, setSendingChoice] = useState<CatalogZone | null>(null);
	const [sendingName, setSendingName] = useState("");
	const [formError, setFormError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState<string | null>(null);
	const [manualRecords, setManualRecords] = useState<DnsRecord[] | null>(null);
	const [verifying, setVerifying] = useState<string | null>(null);
	const [dnsModal, setDnsModal] = useState<{ domain: Domain; records: DnsRecord[] } | null>(null);
	const [copiedKey, setCopiedKey] = useState<string | null>(null);
	const [deleteId, setDeleteId] = useState<string | null>(null);

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

	async function enable(name: string, zoneName: string) {
		setFormError(null);
		setSubmitting(zoneName);
		setManualRecords(null);
		try {
			const result = await createDomainAction({ name, zoneName });
			setSendingChoice(null);
			setManual(false);
			setForm({ name: "", zoneName: "" });
			await load();
			if (result.dns.status === "manual" && result.dns.records.length > 0) {
				const records = result.dns.records.map((record) => ({ ...record, required: true }));
				setManualRecords(records);
				const { data } = await api.get<Domain[]>("/api/domains");
				setDomains(data);
				const created = data.find((domain) => domain.name === name);
				if (created) setDnsModal({ domain: created, records });
			}
		} catch (err: unknown) {
			setFormError(err instanceof Error ? err.message : "Failed to enable domain");
		} finally {
			setSubmitting(null);
		}
	}

	function startEnable(zone: CatalogZone) {
		setFormError(null);
		if (zone.sendingName && zone.sending !== "off") {
			void enable(zone.sendingName, zone.zoneName);
			return;
		}
		setSendingName(`mail.${zone.zoneName}`);
		setSendingChoice(zone);
	}

	async function handleVerify(domain: Domain) {
		setVerifying(domain.id);
		try {
			const res = await verifyDomainAction(domain.id);
			if (res.verified) {
				setDomains((prev) => prev.map((d) => (d.id === domain.id ? { ...d, verified: 1 } : d)));
			}
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
		load();
	}

	function handleCopy(text: string, key: string) {
		navigator.clipboard.writeText(text);
		setCopiedKey(key);
		setTimeout(() => setCopiedKey(null), 2000);
	}

	return (
		<div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
			{/* Delete Confirm Dialog */}
			<Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete sending domain?</DialogTitle>
						<DialogDescription>
							This domain will be removed from your EmailFlare organization. Any keys restricted to it
							will be invalidated.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteId(null)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={confirmDelete}>
							Delete Domain
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={!!sendingChoice} onOpenChange={(open) => !open && setSendingChoice(null)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="text-base font-semibold">Choose the sending name</DialogTitle>
						<DialogDescription className="text-xs">
							{sendingChoice?.zoneName} has no Email Sending subdomain yet. Use the root, or a subdomain
							such as mail.
						</DialogDescription>
					</DialogHeader>
					{formError && (
						<Alert variant="destructive" className="py-2 text-xs">
							<AlertDescription>{formError}</AlertDescription>
						</Alert>
					)}
					<form
						className="space-y-3"
						onSubmit={(e) => {
							e.preventDefault();
							if (sendingChoice) void enable(sendingName, sendingChoice.zoneName);
						}}
					>
						<Label className="text-xs">Sending domain</Label>
						<Input
							value={sendingName}
							onChange={(e) => setSendingName(e.target.value.toLowerCase().trim())}
							className="font-mono text-xs"
							required
						/>
						<DialogFooter>
							<Button type="button" variant="ghost" onClick={() => setSendingChoice(null)}>
								Cancel
							</Button>
							<Button type="submit" disabled={!!submitting}>
								Enable
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div>
					<div className="flex items-center gap-2 mb-1">
						<Globe size={14} className="text-orange-500" />
						<span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
							DNS & Delivery
						</span>
					</div>
					<h1 className="text-2xl font-bold tracking-tight text-foreground">Domains</h1>
					<p className="text-xs text-muted-foreground mt-0.5">
						Turn on a Cloudflare zone. Sending and receiving are set up separately.
					</p>
				</div>
				<Button variant="outline" onClick={() => setManual((open) => !open)} className="gap-1.5 text-xs h-8.5">
					<Plus size={14} />
					<span>Domain not listed?</span>
				</Button>
			</div>

			{catalogNote && (
				<Alert variant="destructive">
					<AlertDescription>{catalogNote}</AlertDescription>
				</Alert>
			)}

			<div className="rounded-xl border border-border bg-card overflow-hidden">
				<div className="px-5 py-3.5 border-b border-border bg-muted/20">
					<span className="text-xs font-semibold">Cloudflare zones</span>
				</div>
				{catalog.length === 0 ? (
					<p className="p-5 text-xs text-muted-foreground">No active zones were returned for this token.</p>
				) : (
					<div className="divide-y divide-border">
						{catalog.map((zone) => (
							<div key={zone.zoneName} className="p-4 flex items-center justify-between gap-3">
								<div>
									<p className="text-sm font-mono font-semibold">{zone.zoneName}</p>
									<p className="text-[11px] text-muted-foreground">
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
									<Button
										size="sm"
										disabled={submitting === zone.zoneName}
										onClick={() => startEnable(zone)}
									>
										{submitting === zone.zoneName && <Loader2 size={13} className="animate-spin" />}
										Enable
									</Button>
								)}
							</div>
						))}
					</div>
				)}
			</div>

			{manual && (
				<form
					className="rounded-xl border border-border p-4 space-y-3"
					onSubmit={(e) => {
						e.preventDefault();
						void enable(form.name, form.zoneName || form.name);
					}}
				>
					<p className="text-xs text-muted-foreground">Only if the zone is missing from the list above.</p>
					<Input
						value={form.zoneName}
						onChange={(e) => setForm({ ...form, zoneName: e.target.value.toLowerCase().trim() })}
						placeholder="Zone name, e.g. acme.com"
						className="font-mono text-xs"
						required
					/>
					<Input
						value={form.name}
						onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().trim() })}
						placeholder="Sending name, e.g. mail.acme.com"
						className="font-mono text-xs"
						required
					/>
					{formError && <p className="text-xs text-destructive">{formError}</p>}
					<Button type="submit" disabled={!!submitting}>
						Enable this name
					</Button>
				</form>
			)}

			{manualRecords && (
				<Alert>
					<AlertDescription className="flex items-center justify-between gap-3">
						<span>DNS was not written. Add the records, then verify.</span>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => {
								const domain = domains.find((item) =>
									manualRecords.some(
										(record) => record.name.endsWith(item.name) || record.name === item.name,
									),
								);
								if (domain) setDnsModal({ domain, records: manualRecords });
							}}
						>
							View DNS records
						</Button>
					</AlertDescription>
				</Alert>
			)}

			{/* Domains Card */}
			<div className="rounded-xl border border-border bg-card overflow-hidden">
				<div className="px-5 py-3.5 border-b border-border bg-muted/20 flex items-center justify-between">
					<span className="text-xs font-semibold text-foreground">Configured Domains ({domains.length})</span>
					<span className="text-[11px] text-muted-foreground">Requires SPF & DKIM DNS records</span>
				</div>

				{loading ? (
					<div className="p-5 space-y-3">
						{[...Array(3)].map((_, i) => (
							<Skeleton key={i} className="h-16 rounded-lg" />
						))}
					</div>
				) : domains.length === 0 ? (
					<div className="text-center py-16 text-muted-foreground space-y-2">
						<Globe size={32} strokeWidth={1.25} className="mx-auto opacity-40 mb-1" />
						<p className="text-xs font-semibold text-foreground">No domains configured yet</p>
						<p className="text-[11px] max-w-sm mx-auto">
							Add a sending domain to unlock deliverability via Cloudflare.
						</p>
					</div>
				) : (
					<div className="divide-y divide-border">
						{domains.map((d) => (
							<div
								key={d.id}
								className="p-4 md:px-5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
							>
								<div className="space-y-1 min-w-0">
									<div className="flex items-center gap-2 flex-wrap">
										{d.verified ? (
											<CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
										) : (
											<Clock size={15} className="text-amber-500 shrink-0" />
										)}

										<span className="text-sm font-semibold font-mono text-foreground">
											{d.name}
										</span>

										{d.verified ? (
											<span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
												VERIFIED
											</span>
										) : (
											<span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
												PENDING DNS
											</span>
										)}

										<span
											className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
											title={d.dkim_selector ? "DKIM selector active" : "DKIM not configured"}
										>
											{d.dkim_selector ? (
												<ShieldCheck
													size={13}
													className="text-emerald-600 dark:text-emerald-400"
												/>
											) : (
												<ShieldOff size={13} className="text-muted-foreground/40" />
											)}
											<span>{d.dkim_selector ? "DKIM Configured" : "No DKIM"}</span>
										</span>
									</div>

									<div className="text-[11px] text-muted-foreground font-mono">ID: {d.id}</div>
								</div>

								<div className="flex items-center gap-2 shrink-0">
									<Button
										variant="outline"
										size="sm"
										onClick={() => handleDns(d)}
										className="h-8 text-xs gap-1.5"
									>
										<ExternalLink size={12} />
										<span>DNS Records</span>
									</Button>

									<Button
										variant="outline"
										size="sm"
										onClick={() => handleVerify(d)}
										disabled={verifying === d.id}
										className="h-8 text-xs gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
									>
										<RefreshCw size={12} className={verifying === d.id ? "animate-spin" : ""} />
										<span>{verifying === d.id ? "Checking..." : "Verify DNS"}</span>
									</Button>

									<Button
										variant="ghost"
										size="sm"
										onClick={() => setDeleteId(d.id)}
										className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
									>
										<Trash2 size={13} />
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* DNS Records Modal */}
			<Dialog open={!!dnsModal} onOpenChange={(open) => !open && setDnsModal(null)}>
				<DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="text-base font-semibold">DNS Configuration Records</DialogTitle>
						<DialogDescription className="text-xs">
							These records were not written automatically. Add them in Cloudflare DNS for{" "}
							<strong className="font-mono text-foreground">{dnsModal?.domain.name}</strong>.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-3 pt-2">
						{dnsModal?.records.map((r, i) => (
							<div
								key={i}
								className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2 text-xs"
							>
								<div className="flex items-center justify-between">
									<Badge
										variant="outline"
										className="text-xs font-mono font-bold text-orange-600 bg-orange-500/10 border-orange-500/20"
									>
										{r.type}
									</Badge>
									<span className="text-[11px] text-muted-foreground">TTL: {r.ttl || "Auto"}</span>
								</div>

								<div className="space-y-1">
									<div className="flex items-center justify-between text-[11px] text-muted-foreground">
										<span>Hostname / Name</span>
										<button
											type="button"
											onClick={() => handleCopy(r.name, `name_${i}`)}
											className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
										>
											{copiedKey === `name_${i}` ? <Check size={10} /> : <Copy size={10} />}
											<span>{copiedKey === `name_${i}` ? "Copied" : "Copy"}</span>
										</button>
									</div>
									<div className="p-2 rounded bg-background border border-border font-mono text-xs text-foreground select-all break-all">
										{r.name}
									</div>
								</div>

								<div className="space-y-1">
									<div className="flex items-center justify-between text-[11px] text-muted-foreground">
										<span>Value / Target</span>
										<button
											type="button"
											onClick={() => handleCopy(r.content, `val_${i}`)}
											className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
										>
											{copiedKey === `val_${i}` ? <Check size={10} /> : <Copy size={10} />}
											<span>{copiedKey === `val_${i}` ? "Copied" : "Copy"}</span>
										</button>
									</div>
									<div className="p-2 rounded bg-background border border-border font-mono text-xs text-foreground select-all break-all">
										{r.content}
									</div>
								</div>
							</div>
						))}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
