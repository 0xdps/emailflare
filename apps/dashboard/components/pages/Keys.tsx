"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Copy, CheckCheck, Key, FlaskConical, Zap } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { createApiKeyAction, revokeApiKeyAction, type ApiKey, type CreatedApiKey as NewKey } from "@/app/actions/keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, PageShell } from "@/components/app/PageHeader";

function timeAgo(iso: string) {
	const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
	if (secs < 60) return `${secs}s ago`;
	if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
	if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
	return `${Math.floor(secs / 86400)}d ago`;
}

const SCOPE_ITEMS = [
	{ value: "global", label: "Global (All Verified Domains)" },
	{ value: "domain", label: "Domain Restricted" },
	{ value: "multi", label: "Multi-domain" },
];

const KEY_TYPE_ITEM_CLASS =
	"h-auto flex-1 justify-start gap-2 rounded-lg border border-border p-2.5 text-left data-pressed:border-primary/50 data-pressed:bg-primary-muted";

function copyToClipboard(text: string, message: string) {
	navigator.clipboard.writeText(text).then(
		() => toast.success(message),
		() => toast.error("Could not copy to clipboard"),
	);
}

export interface KeysPageProps {
	initialKeys?: ApiKey[];
}

export default function KeysPage({ initialKeys }: KeysPageProps = {}) {
	const [keys, setKeys] = useState<ApiKey[]>(initialKeys ? initialKeys.filter((k) => k.active) : []);
	const [loading, setLoading] = useState(!initialKeys);
	const [creating, setCreating] = useState(false);
	const [newKey, setNewKey] = useState<NewKey | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [domains, setDomains] = useState<{ id: string; name: string }[]>([]);
	const [form, setForm] = useState({
		name: "",
		type: "live" as "test" | "live",
		scope: "global" as "global" | "domain" | "multi",
		domainIds: [] as string[],
	});
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
		api.get<{ id: string; name: string }[]>("/api/domains")
			.then((res) => setDomains(res.data))
			.catch(() => setDomains([]));
	}, [initialKeys]);

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		setSubmitting(true);
		try {
			const data = await createApiKeyAction(form);
			setNewKey(data);
			setCreating(false);
			setForm({ name: "", type: "live", scope: "global", domainIds: [] });
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

	return (
		<PageShell>
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
						<DialogTitle>Create API Key</DialogTitle>
						<DialogDescription>
							Generate a programmatic API key for transactional email delivery.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleCreate} className="space-y-4 pt-2">
						<div className="space-y-1.5">
							<Label htmlFor="key-name">Key Name / Description</Label>
							<Input
								id="key-name"
								value={form.name}
								onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
								required
								placeholder="e.g. Production Backend, Signup Worker, CI/CD"
							/>
						</div>

						<div className="space-y-1.5">
							<Label>Environment & Type</Label>
							<ToggleGroup
								value={[form.type]}
								onValueChange={(value) => {
									const next = value[0];
									if (next === "live" || next === "test") setForm((f) => ({ ...f, type: next }));
								}}
								className="grid w-full grid-cols-2"
							>
								<ToggleGroupItem value="live" className={KEY_TYPE_ITEM_CLASS}>
									<Zap className="shrink-0 text-primary" />
									<span className="min-w-0">
										<span className="block text-xs font-semibold">Live Mode</span>
										<span className="block truncate font-mono text-2xs text-muted-foreground">
											eflive_...
										</span>
									</span>
								</ToggleGroupItem>
								<ToggleGroupItem value="test" className={KEY_TYPE_ITEM_CLASS}>
									<FlaskConical className="shrink-0 text-info" />
									<span className="min-w-0">
										<span className="block text-xs font-semibold">Sandbox Test</span>
										<span className="block truncate font-mono text-2xs text-muted-foreground">
											eftest_...
										</span>
									</span>
								</ToggleGroupItem>
							</ToggleGroup>
							<p className="text-2xs text-muted-foreground">
								{form.type === "test"
									? "Emails sent with this test key will be captured into the in-house Test Mailbox without delivering."
									: "Emails sent with this live key will be delivered via Cloudflare Email Routing."}
							</p>
						</div>

						<div className="space-y-1.5">
							<Label>Scope</Label>
							<Select
								items={SCOPE_ITEMS}
								value={form.scope}
								onValueChange={(v) => setForm((f) => ({ ...f, scope: v as typeof form.scope }))}
							>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{SCOPE_ITEMS.map((item) => (
										<SelectItem key={item.value} value={item.value}>
											{item.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{form.scope !== "global" && (
								<div className="space-y-2 pt-1">
									{domains.map((domain) => (
										<Label key={domain.id} className="text-xs font-normal">
											<Checkbox
												checked={form.domainIds.includes(domain.id)}
												onCheckedChange={(checked) =>
													setForm((current) => ({
														...current,
														domainIds: checked
															? [...current.domainIds, domain.id]
															: current.domainIds.filter((id) => id !== domain.id),
													}))
												}
											/>
											<span className="font-mono">{domain.name}</span>
										</Label>
									))}
									{domains.length === 0 && (
										<p className="text-2xs text-muted-foreground">Enable a domain first.</p>
									)}
								</div>
							)}
						</div>

						<DialogFooter className="pt-2">
							<Button type="button" variant="ghost" onClick={() => setCreating(false)}>
								Cancel
							</Button>
							<Button type="submit" disabled={submitting}>
								{submitting ? "Generating..." : "Create Secret Key"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<PageHeader
				eyebrow="Credentials & Auth"
				title="API keys"
				description={
					<>
						Authenticate transactional HTTP requests to{" "}
						<code className="font-mono text-foreground">POST /v1/send</code>.
					</>
				}
				actions={
					<Button onClick={() => setCreating(true)}>
						<Plus />
						<span>New API Key</span>
					</Button>
				}
			/>

			{/* Newly Created Key Alert Banner */}
			{newKey && (
				<Alert variant="success" className="space-y-3 p-4">
					<CheckCheck />
					<AlertTitle>API Key Created — Save It Now</AlertTitle>
					<AlertAction>
						<Button variant="ghost" size="xs" onClick={() => setNewKey(null)}>
							Dismiss
						</Button>
					</AlertAction>
					<AlertDescription className="col-start-2 text-current">
						Please copy your key immediately. For security reasons, you will not be able to view the full
						token again.
					</AlertDescription>
					<div className="col-span-full flex items-center gap-2 rounded-lg border border-border bg-background p-2">
						<code className="flex-1 font-mono text-xs font-semibold break-all text-foreground select-all">
							{newKey.key}
						</code>
						<Button
							variant="secondary"
							size="sm"
							onClick={() => copyToClipboard(newKey.key, "API key copied")}
							className="shrink-0"
						>
							<Copy />
							<span>Copy Key</span>
						</Button>
					</div>
				</Alert>
			)}

			{/* API Keys */}
			<Card className="gap-0 py-0">
				<div className="flex items-center justify-between border-b border-border bg-muted/20 px-5 py-3.5">
					<span className="text-sm font-semibold text-foreground">Active API Keys ({keys.length})</span>
					<span className="text-2xs text-muted-foreground">Header: Authorization: Bearer &lt;key&gt;</span>
				</div>

				{loading ? (
					<div className="space-y-2 p-4">
						{[...Array(3)].map((_, i) => (
							<Skeleton key={i} className="h-14 rounded-lg" />
						))}
					</div>
				) : keys.length === 0 ? (
					<Empty className="py-16">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Key />
							</EmptyMedia>
							<EmptyTitle>No active API keys found</EmptyTitle>
							<EmptyDescription>
								Create your first API key to start dispatching transactional emails programmatically.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<div className="divide-y divide-border">
						{keys.map((k) => {
							const isTest = k.key_type === "test";
							return (
								<div
									key={k.id}
									className="flex flex-col justify-between gap-3 p-4 transition-colors hover:bg-muted/30 md:flex-row md:items-center md:px-5"
								>
									<div className="min-w-0 space-y-1">
										<div className="flex flex-wrap items-center gap-2">
											<span className="text-sm font-semibold text-foreground">{k.name}</span>

											{isTest ? (
												<Badge variant="info">TEST SANDBOX</Badge>
											) : (
												<Badge variant="success">LIVE PRODUCTION</Badge>
											)}

											<Badge variant="outline" className="font-mono capitalize">
												{k.scope}
											</Badge>
										</div>

										<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
											<div className="flex items-center gap-1 font-mono text-2xs">
												<span>{k.key_prefix}...</span>
												<Button
													type="button"
													variant="ghost"
													size="icon-xs"
													aria-label="Copy key prefix"
													title="Copy key prefix"
													onClick={() => copyToClipboard(k.key_prefix, "Key prefix copied")}
												>
													<Copy />
												</Button>
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

									<div className="flex shrink-0 items-center gap-2">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => setRevokeId(k.id)}
											className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
										>
											<Trash2 />
											<span>Revoke</span>
										</Button>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</Card>
		</PageShell>
	);
}
