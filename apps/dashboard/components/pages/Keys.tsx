"use client";

import { useEffect, useState } from "react";
import {
	Plus,
	Trash2,
	Copy,
	CheckCheck,
	Key,
	X,
	FlaskConical,
	Zap,
	ShieldCheck,
	Clock,
	Check,
	Radio,
} from "lucide-react";
import api from "@/lib/api";
import { createApiKeyAction, revokeApiKeyAction, type ApiKey, type CreatedApiKey as NewKey } from "@/app/actions/keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

function timeAgo(iso: string) {
	const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
	if (secs < 60) return `${secs}s ago`;
	if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
	if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
	return `${Math.floor(secs / 86400)}d ago`;
}

export interface KeysPageProps {
	initialKeys?: ApiKey[];
}

export default function KeysPage({ initialKeys }: KeysPageProps = {}) {
	const [keys, setKeys] = useState<ApiKey[]>(initialKeys ? initialKeys.filter((k) => k.active) : []);
	const [loading, setLoading] = useState(!initialKeys);
	const [creating, setCreating] = useState(false);
	const [newKey, setNewKey] = useState<NewKey | null>(null);
	const [copied, setCopied] = useState(false);
	const [copiedPrefixId, setCopiedPrefixId] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [form, setForm] = useState({ name: "", type: "live" as "test" | "live", scope: "global" as const });
	const [revokeId, setRevokeId] = useState<string | null>(null);

	async function load() {
		setLoading(true);
		try {
			const { data } = await api.get<ApiKey[]>("/api/keys");
			setKeys(data.filter((k) => k.active));
		} catch {
			setKeys([]);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		if (!initialKeys) {
			load();
		}
	}, [initialKeys]);

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		setSubmitting(true);
		try {
			const data = await createApiKeyAction(form);
			setNewKey(data);
			setCreating(false);
			setForm({ name: "", type: "live", scope: "global" });
			load();
		} finally {
			setSubmitting(false);
		}
	}

	async function confirmRevoke() {
		if (!revokeId) return;
		await revokeApiKeyAction(revokeId);
		setRevokeId(null);
		load();
	}

	function copyKey(key: string) {
		navigator.clipboard.writeText(key);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	function copyPrefix(id: string, prefix: string) {
		navigator.clipboard.writeText(prefix);
		setCopiedPrefixId(id);
		setTimeout(() => setCopiedPrefixId(null), 2000);
	}

	return (
		<div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
			{/* Confirm revoke dialog */}
			<Dialog open={!!revokeId} onOpenChange={(open) => !open && setRevokeId(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Revoke API key?</DialogTitle>
						<DialogDescription>
							This key will stop authenticating immediately. Any application or script relying on it will
							fail.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setRevokeId(null)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={confirmRevoke}>
							Revoke Key
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Create API Key Dialog */}
			<Dialog open={creating} onOpenChange={(open) => !open && setCreating(false)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="text-base font-semibold">Create API Key</DialogTitle>
						<DialogDescription className="text-xs">
							Generate a programmatic API key for transactional email delivery.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleCreate} className="space-y-4 pt-2">
						<div className="space-y-1.5">
							<Label className="text-xs">Key Name / Description</Label>
							<Input
								value={form.name}
								onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
								required
								placeholder="e.g. Production Backend, Signup Worker, CI/CD"
								className="h-8.5 text-xs"
							/>
						</div>

						<div className="space-y-1.5">
							<Label className="text-xs">Environment & Type</Label>
							<div className="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => setForm((f) => ({ ...f, type: "live" }))}
									className={cn(
										"flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all",
										form.type === "live"
											? "border-orange-500/50 bg-orange-500/10 text-foreground font-semibold"
											: "border-border text-muted-foreground hover:bg-muted/40",
									)}
								>
									<Zap size={14} className="text-orange-600 shrink-0" />
									<div className="min-w-0">
										<div className="text-xs font-semibold">Live Mode</div>
										<div className="text-[10px] text-muted-foreground truncate font-mono">
											eflive_...
										</div>
									</div>
								</button>

								<button
									type="button"
									onClick={() => setForm((f) => ({ ...f, type: "test" }))}
									className={cn(
										"flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all",
										form.type === "test"
											? "border-purple-500/50 bg-purple-500/10 text-foreground font-semibold"
											: "border-border text-muted-foreground hover:bg-muted/40",
									)}
								>
									<FlaskConical size={14} className="text-purple-600 shrink-0" />
									<div className="min-w-0">
										<div className="text-xs font-semibold">Sandbox Test</div>
										<div className="text-[10px] text-muted-foreground truncate font-mono">
											eftest_...
										</div>
									</div>
								</button>
							</div>
							<p className="text-[11px] text-muted-foreground">
								{form.type === "test"
									? "Emails sent with this test key will be captured into the in-house Test Mailbox without delivering."
									: "Emails sent with this live key will be delivered via Cloudflare Email Routing."}
							</p>
						</div>

						<div className="space-y-1.5">
							<Label className="text-xs">Scope</Label>
							<Select
								value={form.scope}
								onValueChange={(v) => setForm((f) => ({ ...f, scope: v as typeof form.scope }))}
							>
								<SelectTrigger className="h-8.5 text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="global" className="text-xs">
										Global (All Verified Domains)
									</SelectItem>
									<SelectItem value="domain" className="text-xs">
										Domain Restricted
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<DialogFooter className="pt-2">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setCreating(false)}
								className="h-8 text-xs"
							>
								Cancel
							</Button>
							<Button type="submit" disabled={submitting} className="h-8 text-xs">
								{submitting ? "Generating..." : "Create Secret Key"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div>
					<div className="flex items-center gap-2 mb-1">
						<Key size={14} className="text-orange-500" />
						<span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
							Credentials & Auth
						</span>
					</div>
					<h1 className="text-2xl font-bold tracking-tight text-foreground">API keys</h1>
					<p className="text-xs text-muted-foreground mt-0.5">
						Authenticate transactional HTTP requests to{" "}
						<code className="text-foreground font-mono">POST /v1/send</code>.
					</p>
				</div>
				<Button onClick={() => setCreating(true)} className="gap-1.5 text-xs h-8.5 shadow-xs">
					<Plus size={14} />
					<span>New API Key</span>
				</Button>
			</div>

			{/* Newly Created Key Alert Banner */}
			{newKey && (
				<div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 p-4 space-y-3">
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-xs">
							<CheckCheck size={16} />
							<span>API Key Created — Save It Now</span>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setNewKey(null)}
							className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
						>
							Dismiss
						</Button>
					</div>

					<p className="text-xs text-emerald-900/80 dark:text-emerald-200/80">
						Please copy your key immediately. For security reasons, you will not be able to view the full
						token again.
					</p>

					<div className="flex items-center gap-2 bg-background border border-emerald-300/80 dark:border-emerald-800 rounded-lg p-2">
						<code className="text-xs font-mono text-foreground font-semibold flex-1 select-all break-all">
							{newKey.key}
						</code>
						<Button
							variant="secondary"
							size="sm"
							onClick={() => copyKey(newKey.key)}
							className="h-7 text-xs gap-1.5 shrink-0"
						>
							{copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
							<span>{copied ? "Copied" : "Copy Key"}</span>
						</Button>
					</div>
				</div>
			)}

			{/* API Keys Table / Card */}
			<div className="rounded-xl border border-border bg-card overflow-hidden">
				<div className="px-5 py-3.5 border-b border-border bg-muted/20 flex items-center justify-between">
					<span className="text-xs font-semibold text-foreground">Active API Keys ({keys.length})</span>
					<span className="text-[11px] text-muted-foreground">Header: Authorization: Bearer &lt;key&gt;</span>
				</div>

				{loading ? (
					<div className="p-5 space-y-3">
						{[...Array(3)].map((_, i) => (
							<Skeleton key={i} className="h-14 rounded-lg" />
						))}
					</div>
				) : keys.length === 0 ? (
					<div className="text-center py-16 text-muted-foreground space-y-2">
						<Key size={32} strokeWidth={1.25} className="mx-auto opacity-40 mb-1" />
						<p className="text-xs font-semibold text-foreground">No active API keys found</p>
						<p className="text-[11px] max-w-sm mx-auto">
							Create your first API key to start dispatching transactional emails programmatically.
						</p>
					</div>
				) : (
					<div className="divide-y divide-border">
						{keys.map((k) => {
							const isTest = k.key_type === "test";
							return (
								<div
									key={k.id}
									className="p-4 md:px-5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
								>
									<div className="space-y-1 min-w-0">
										<div className="flex items-center gap-2 flex-wrap">
											<span className="text-xs font-semibold text-foreground">{k.name}</span>

											{isTest ? (
												<span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
													TEST SANDBOX
												</span>
											) : (
												<span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
													LIVE PRODUCTION
												</span>
											)}

											<Badge variant="outline" className="text-[10px] font-mono capitalize">
												{k.scope}
											</Badge>
										</div>

										<div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
											<div className="flex items-center gap-1 font-mono text-[11px]">
												<span>{k.key_prefix}...</span>
												<button
													type="button"
													onClick={() => copyPrefix(k.id, k.key_prefix)}
													className="text-muted-foreground hover:text-foreground ml-0.5"
													title="Copy key prefix"
												>
													{copiedPrefixId === k.id ? (
														<Check size={11} className="text-emerald-500" />
													) : (
														<Copy size={11} />
													)}
												</button>
											</div>

											<span>·</span>
											<span className="tabular-nums">
												{k.send_count.toLocaleString()} emails sent
											</span>

											<span>·</span>
											<span>
												{k.last_used_at ? `Last used ${timeAgo(k.last_used_at)}` : "Never used"}
											</span>
										</div>
									</div>

									<div className="flex items-center gap-2 shrink-0">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => setRevokeId(k.id)}
											className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
										>
											<Trash2 size={12} className="mr-1.5" />
											<span>Revoke</span>
										</Button>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
