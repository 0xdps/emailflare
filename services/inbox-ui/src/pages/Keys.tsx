import { useEffect, useState } from "react";
import { Plus, Trash2, Copy, CheckCheck, Key, X } from "lucide-react";
import api from "../api";
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

interface ApiKey {
	id: string;
	name: string;
	key_prefix: string;
	key_type: "test" | "live";
	scope: "global" | "domain" | "multi";
	active: number;
	last_used_at: string | null;
	send_count: number;
	created_at: string;
}

interface NewKey extends ApiKey {
	key: string;
}

function timeAgo(iso: string) {
	const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
	if (secs < 60) return `${secs}s ago`;
	if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
	if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
	return `${Math.floor(secs / 86400)}d ago`;
}

export default function KeysPage() {
	const [keys, setKeys] = useState<ApiKey[]>([]);
	const [loading, setLoading] = useState(true);
	const [creating, setCreating] = useState(false);
	const [newKey, setNewKey] = useState<NewKey | null>(null);
	const [copied, setCopied] = useState(false);
	const [form, setForm] = useState({ name: "", type: "live" as "test" | "live", scope: "global" as const });
	const [revokeId, setRevokeId] = useState<string | null>(null);

	async function load() {
		setLoading(true);
		const { data } = await api.get<ApiKey[]>("/api/keys");
		setKeys(data.filter((k) => k.active));
		setLoading(false);
	}

	useEffect(() => {
		load();
	}, []);

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		const { data } = await api.post<NewKey>("/api/keys", form);
		setNewKey(data);
		setCreating(false);
		setForm({ name: "", type: "live", scope: "global" });
		load();
	}

	async function confirmRevoke() {
		if (!revokeId) return;
		await api.delete(`/api/keys/${revokeId}`);
		setRevokeId(null);
		load();
	}

	function copyKey(key: string) {
		navigator.clipboard.writeText(key);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	return (
		<div className="p-6">
			<div className="max-w-[580px]">
				{/* Confirm revoke dialog */}
				<Dialog open={!!revokeId} onOpenChange={(open) => !open && setRevokeId(null)}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Revoke API key?</DialogTitle>
							<DialogDescription>
								This key will stop working immediately and cannot be restored.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button variant="outline" onClick={() => setRevokeId(null)}>
								Cancel
							</Button>
							<Button variant="destructive" onClick={confirmRevoke}>
								Revoke
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<div>
						<div className="flex items-center gap-2 mb-1">
							<Key size={14} className="text-primary" />
							<span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
								Auth
							</span>
						</div>
						<h1 className="text-2xl font-bold">API Keys</h1>
					</div>
					<Button onClick={() => setCreating(true)}>
						<Plus size={14} data-icon="inline-start" /> New key
					</Button>
				</div>

				{/* New key banner */}
				{newKey && (
					<Alert className="mb-6 border-emerald-200 bg-emerald-50">
						<AlertDescription className="flex items-start justify-between gap-4">
							<div>
								<p className="text-sm font-semibold text-emerald-700 mb-1">
									{newKey.key_type === "test" ? "Test key created — " : ""}Copy your new API key — it
									won't be shown again
								</p>
								<code className="text-xs font-mono text-emerald-800 break-all">{newKey.key}</code>
								<div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setNewKey(null)}
										className="mt-2 h-auto p-0 text-xs text-muted-foreground"
									>
										Dismiss
									</Button>
								</div>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => copyKey(newKey.key)}
								className="flex-shrink-0 text-emerald-700 hover:text-emerald-800 gap-1.5"
							>
								{copied ? <CheckCheck size={14} /> : <Copy size={14} />}
								{copied ? "Copied!" : "Copy"}
							</Button>
						</AlertDescription>
					</Alert>
				)}

				{/* Create form */}
				{creating && (
					<Card className="mb-6">
						<CardContent className="pt-5 flex flex-col gap-4">
							<div className="flex items-center justify-between">
								<h2 className="font-semibold text-sm">New API key</h2>
								<Button
									variant="ghost"
									size="icon"
									className="size-6"
									onClick={() => setCreating(false)}
								>
									<X size={14} />
								</Button>
							</div>
							<form onSubmit={handleCreate} className="flex flex-col gap-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="flex flex-col gap-1.5">
										<Label>Name</Label>
										<Input
											value={form.name}
											onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
											required
											placeholder="My integration"
										/>
									</div>
									<div className="flex flex-col gap-1.5">
										<Label>Type</Label>
										<Select
											value={form.type}
											onValueChange={(v) =>
												setForm((f) => ({ ...f, type: v as typeof form.type }))
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="live">Live</SelectItem>
												<SelectItem value="test">Test</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
								<div className="flex flex-col gap-1.5">
									<Label>Scope</Label>
									<Select
										value={form.scope}
										onValueChange={(v) => setForm((f) => ({ ...f, scope: v as typeof form.scope }))}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="global">Global</SelectItem>
											<SelectItem value="domain">Domain</SelectItem>
											<SelectItem value="multi">Multi-domain</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="flex gap-2">
									<Button type="submit">Create</Button>
									<Button type="button" variant="ghost" onClick={() => setCreating(false)}>
										Cancel
									</Button>
								</div>
							</form>
						</CardContent>
					</Card>
				)}

				{/* Key list */}
				{loading ? (
					<div className="flex flex-col gap-2">
						{[...Array(2)].map((_, i) => (
							<Skeleton key={i} className="h-14 rounded-xl" />
						))}
					</div>
				) : keys.length === 0 ? (
					<div className="text-center py-20 text-muted-foreground text-sm">No active API keys.</div>
				) : (
					<Card className="overflow-hidden p-0 divide-y divide-border">
						{keys.map((k) => (
							<div key={k.id} className="flex items-center px-5 py-3.5 gap-4">
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="font-medium text-sm">{k.name}</span>
										<Badge variant="secondary" className="font-mono text-xs">
											{k.scope}
										</Badge>{" "}
										{k.key_type === "test" ? (
											<Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-200">
												test
											</Badge>
										) : (
											<Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-200">
												live
											</Badge>
										)}{" "}
									</div>
									<div className="flex items-center gap-3 mt-0.5">
										<code className="text-xs text-muted-foreground font-mono">{k.key_prefix}…</code>
										<span className="text-xs text-muted-foreground">
											{k.send_count.toLocaleString()} sends
										</span>
										{k.last_used_at && (
											<span className="text-xs text-muted-foreground">
												last used {timeAgo(k.last_used_at)}
											</span>
										)}
									</div>
								</div>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setRevokeId(k.id)}
									className="text-xs gap-1.5 h-7 px-2.5 text-muted-foreground hover:text-destructive"
								>
									<Trash2 size={11} /> Revoke
								</Button>
							</div>
						))}
					</Card>
				)}
			</div>
		</div>
	);
}
