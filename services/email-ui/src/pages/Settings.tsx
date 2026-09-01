import { useEffect, useState, useCallback } from "react";
import {
	Settings2,
	Zap,
	CheckCircle2,
	AlertCircle,
	RefreshCw,
	Eye,
	EyeOff,
	Globe,
	ChevronRight,
	Loader2,
	Copy,
	Check,
	Download,
} from "lucide-react";
import api from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DomainRoutingStatus {
	id: string;
	name: string;
	return_path_domain: string | null;
	routingEnabled: boolean;
	routingConfigured: boolean;
}

interface BounceStatus {
	deployed: boolean;
	modifiedOn: string | null;
	workerName: string;
	publicUrl: string;
	domains: DomainRoutingStatus[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateSecret(len = 32) {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	return Array.from(crypto.getRandomValues(new Uint8Array(len)))
		.map((b) => chars[b % chars.length])
		.join("");
}

function CopyButton({ value }: { value: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<Button
			variant="ghost"
			size="icon"
			className="h-7 w-7"
			onClick={() => {
				navigator.clipboard.writeText(value);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			}}
		>
			{copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
		</Button>
	);
}

// ── Domain row ────────────────────────────────────────────────────────────────

function DomainRow({
	domain,
	workerDeployed,
	onSetupDomain,
}: {
	domain: DomainRoutingStatus;
	workerDeployed: boolean;
	onSetupDomain: (id: string) => Promise<void>;
}) {
	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState("");

	async function handle() {
		setErr("");
		setLoading(true);
		try {
			await onSetupDomain(domain.id);
		} catch (e: unknown) {
			setErr(e instanceof Error ? e.message : "Failed");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="flex items-center gap-3 py-2.5 px-3 rounded-md hover:bg-muted/40 transition-colors">
			<Globe size={14} className="text-muted-foreground flex-shrink-0" />
			<div className="flex-1 min-w-0">
				<p className="text-[13px] font-medium truncate">{domain.name}</p>
				{domain.return_path_domain && (
					<p className="text-[11px] text-muted-foreground truncate">
						return-path: {domain.return_path_domain}
					</p>
				)}
			</div>
			{domain.routingConfigured ? (
				<Badge className="text-[11px] px-1.5 py-0 bg-green-500/10 text-green-600 border-green-200 border">
					Routing active
				</Badge>
			) : (
				<div className="flex items-center gap-2">
					{err && <span className="text-[11px] text-destructive">{err}</span>}
					<Button
						size="sm"
						variant="outline"
						className="h-7 text-[12px]"
						disabled={!workerDeployed || loading}
						onClick={handle}
					>
						{loading ? (
							<Loader2 size={12} className="animate-spin mr-1" />
						) : (
							<ChevronRight size={12} className="mr-1" />
						)}
						Setup routing
					</Button>
				</div>
			)}
		</div>
	);
}

// ── Deployment mode ───────────────────────────────────────────────────────────

const IS_CLOUDFLARE = import.meta.env.VITE_DEPLOYMENT_MODE === "cloudflare";

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
	const [status, setStatus] = useState<BounceStatus | null>(null);
	const [loading, setLoading] = useState(true);

	// Form state
	const [backendUrl, setBackendUrl] = useState("");
	const [webhookSecret, setWebhookSecret] = useState("");
	const [workerName, setWorkerName] = useState("");
	const [showSecret, setShowSecret] = useState(false);
	const [showAdvanced, setShowAdvanced] = useState(false);

	// Action state
	const [deploying, setDeploying] = useState(false);
	const [deployError, setDeployError] = useState("");
	const [deploySuccess, setDeploySuccess] = useState(false);

	// Backfill state
	const [backfilling, setBackfilling] = useState(false);
	const [backfillResult, setBackfillResult] = useState<{ imported: number; existing: number } | null>(null);
	const [backfillError, setBackfillError] = useState("");

	const fetchStatus = useCallback(async () => {
		try {
			const res = await api.get<BounceStatus>("/api/cloudflare/bounce-status");
			setStatus(res.data);
			// Pre-fill form from what we know
			if (res.data.publicUrl && !backendUrl) setBackendUrl(res.data.publicUrl);
			if (res.data.workerName && !workerName) setWorkerName(res.data.workerName);
			if (!webhookSecret) setWebhookSecret(generateSecret());
		} catch {
			// ignore — CF may not be configured
		} finally {
			setLoading(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!IS_CLOUDFLARE) fetchStatus();
	}, [fetchStatus]);

	async function handleDeploy() {
		setDeployError("");
		setDeploySuccess(false);
		setDeploying(true);
		try {
			await api.post("/api/cloudflare/bounce-setup", {
				backendUrl,
				webhookSecret,
				...(workerName !== (status?.workerName ?? "emailflare-bounce") ? { workerName } : {}),
			});
			setDeploySuccess(true);
			await fetchStatus();
		} catch (e: unknown) {
			const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
			setDeployError(msg ?? (e instanceof Error ? e.message : "Deploy failed"));
		} finally {
			setDeploying(false);
		}
	}

	async function handleSetupDomain(domainId: string) {
		await api.post(`/api/cloudflare/bounce-setup-domain/${domainId}`);
		await fetchStatus();
	}

	async function handleBackfill() {
		setBackfillError("");
		setBackfillResult(null);
		setBackfilling(true);
		try {
			const res = await api.post<{ imported: number; existing: number }>("/api/cloudflare/backfill-domains");
			setBackfillResult(res.data);
		} catch (e: unknown) {
			const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
			setBackfillError(msg ?? (e instanceof Error ? e.message : "Backfill failed"));
		} finally {
			setBackfilling(false);
		}
	}

	const allConfigured = status?.domains.length ? status.domains.every((d) => d.routingConfigured) : false;

	return (
		<div className="p-6 max-w-2xl space-y-8">
			{/* ── Header ─────────────────────────────────────────────────────── */}
			<div>
				<div className="flex items-center gap-2 mb-1">
					<Settings2 size={18} className="text-muted-foreground" />
					<h1 className="text-[18px] font-semibold">Settings</h1>
				</div>
				<p className="text-sm text-muted-foreground">
					Configure integrations and automation for your emailflare deployment.
				</p>
			</div>

			<Separator />

			{/* ── Bounce Forwarding — standalone (Railway) deployments only ── */}
			{!IS_CLOUDFLARE && (
				<section className="space-y-4">
					<div className="flex items-start gap-3">
						<div className="mt-0.5 rounded-md p-1.5 bg-orange-500/10">
							<Zap size={15} className="text-orange-500" />
						</div>
						<div>
							<h2 className="text-[15px] font-semibold leading-tight">Bounce Forwarding</h2>
							<p className="text-[13px] text-muted-foreground mt-0.5">
								Deploy a Cloudflare Worker to receive bounce and complaint emails via CF Email Routing
								and forward them to this backend's webhook. Once set up, new domains are wired
								automatically.
							</p>
						</div>
					</div>

					{/* Worker status */}
					{!loading && status && (
						<div
							className={`flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[13px] border
            ${
				status.deployed
					? "bg-green-500/5 border-green-200 text-green-700"
					: "bg-amber-500/5 border-amber-200 text-amber-700"
			}`}
						>
							{status.deployed ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
							<span className="font-medium">
								{status.deployed ? (
									<>
										Worker <code className="font-mono">{status.workerName}</code> is deployed
										{status.modifiedOn
											? ` · last updated ${new Date(status.modifiedOn).toLocaleDateString()}`
											: ""}
									</>
								) : (
									"Worker not deployed yet"
								)}
							</span>
							{status.deployed && allConfigured && (
								<Badge className="ml-auto text-[11px] px-1.5 py-0 bg-green-500/10 text-green-600 border-green-200 border">
									All domains active
								</Badge>
							)}
						</div>
					)}

					{/* Setup form */}
					<div className="rounded-lg border bg-card p-4 space-y-4">
						<p className="text-[13px] font-medium">
							{status?.deployed ? "Update & Redeploy" : "Initial Setup"}
						</p>

						<div className="space-y-1.5">
							<Label className="text-[12px]">Backend URL</Label>
							<Input
								value={backendUrl}
								onChange={(e) => setBackendUrl(e.target.value)}
								placeholder="https://your-app.railway.app"
								className="h-8 text-[13px] font-mono"
							/>
							<p className="text-[11px] text-muted-foreground">
								The public URL of this backend. The Worker will POST bounces to{" "}
								<code className="text-[11px]">{backendUrl || "<url>"}/api/webhooks/bounce</code>.
							</p>
						</div>

						<div className="space-y-1.5">
							<Label className="text-[12px]">Webhook Secret</Label>
							<div className="flex gap-2">
								<div className="relative flex-1">
									<Input
										type={showSecret ? "text" : "password"}
										value={webhookSecret}
										onChange={(e) => setWebhookSecret(e.target.value)}
										className="h-8 text-[13px] font-mono pr-8"
									/>
									<button
										type="button"
										onClick={() => setShowSecret((v) => !v)}
										className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
									>
										{showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
									</button>
								</div>
								<CopyButton value={webhookSecret} />
								<Button
									variant="outline"
									size="sm"
									className="h-8 text-[12px]"
									onClick={() => setWebhookSecret(generateSecret())}
								>
									Regenerate
								</Button>
							</div>
							<p className="text-[11px] text-muted-foreground">
								Set this as <code className="text-[11px]">WEBHOOK_SECRET</code> in your backend
								environment variables as well.
							</p>
						</div>

						{/* Advanced toggle */}
						<div>
							<button
								type="button"
								className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
								onClick={() => setShowAdvanced((v) => !v)}
							>
								<ChevronRight
									size={12}
									className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`}
								/>
								Advanced
							</button>
							{showAdvanced && (
								<div className="mt-3 space-y-1.5">
									<Label className="text-[12px]">Worker name</Label>
									<Input
										value={workerName}
										onChange={(e) => setWorkerName(e.target.value)}
										placeholder="emailflare-bounce"
										className="h-8 text-[13px] font-mono"
									/>
									<p className="text-[11px] text-muted-foreground">
										The CF Worker script name. Default:{" "}
										<code className="text-[11px]">emailflare-bounce</code>.
									</p>
								</div>
							)}
						</div>

						{deployError && (
							<p className="text-[12px] text-destructive flex items-center gap-1.5">
								<AlertCircle size={12} /> {deployError}
							</p>
						)}
						{deploySuccess && (
							<p className="text-[12px] text-green-600 flex items-center gap-1.5">
								<CheckCircle2 size={12} /> Worker deployed successfully.
							</p>
						)}

						<div className="flex items-center gap-2 pt-1">
							<Button
								size="sm"
								className="h-8 text-[13px]"
								disabled={deploying || !backendUrl || webhookSecret.length < 16}
								onClick={handleDeploy}
							>
								{deploying ? (
									<>
										<Loader2 size={13} className="animate-spin mr-1.5" />
										Deploying…
									</>
								) : status?.deployed ? (
									<>
										<RefreshCw size={13} className="mr-1.5" />
										Update & Redeploy
									</>
								) : (
									<>
										<Zap size={13} className="mr-1.5" />
										Deploy Worker
									</>
								)}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 text-[12px]"
								onClick={fetchStatus}
								disabled={loading}
							>
								<RefreshCw size={12} className={`mr-1.5 ${loading ? "animate-spin" : ""}`} />
								Refresh
							</Button>
						</div>
					</div>

					{/* Per-domain routing table */}
					{status?.domains && status.domains.length > 0 && (
						<div className="rounded-lg border overflow-hidden">
							<div className="px-3 py-2 border-b bg-muted/30">
								<p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
									Domain routing rules
								</p>
							</div>
							<div className="divide-y">
								{status.domains.map((domain) => (
									<DomainRow
										key={domain.id}
										domain={domain}
										workerDeployed={status.deployed}
										onSetupDomain={handleSetupDomain}
									/>
								))}
							</div>
						</div>
					)}

					{/* Required CF token permissions note */}
					<div className="rounded-lg border border-dashed px-4 py-3 text-[12px] text-muted-foreground space-y-1">
						<p className="font-medium text-foreground">Required CF token permissions</p>
						<ul className="list-disc list-inside space-y-0.5">
							<li>Account → Workers Scripts: Edit</li>
							<li>Zone → Email Routing Rules: Edit</li>
							<li>Zone → Zone: Read (already required for domain setup)</li>
						</ul>
					</div>
				</section>
			)}

			<Separator />

			{/* ── Backfill from Cloudflare ─────────────────────────────────── */}
			<section className="space-y-4">
				<div className="flex items-start gap-3">
					<div className="mt-0.5 rounded-md p-1.5 bg-blue-500/10">
						<Download size={15} className="text-blue-500" />
					</div>
					<div>
						<h2 className="text-[15px] font-semibold leading-tight">Backfill from Cloudflare</h2>
						<p className="text-[13px] text-muted-foreground mt-0.5">
							Import domains that were configured directly in your Cloudflare account outside of
							emailflare. Email delivery history cannot be recovered — Cloudflare does not expose outbound
							email logs via its API.
						</p>
					</div>
				</div>

				<div className="rounded-lg border bg-card p-4 space-y-4">
					<div className="space-y-1">
						<p className="text-[13px] font-medium">Import domains</p>
						<p className="text-[12px] text-muted-foreground">
							Scans all active Cloudflare zones for Email Sending Subdomains and imports any that are not
							yet registered in emailflare.
						</p>
					</div>

					{backfillResult && (
						<div
							className={`rounded-md px-3 py-2.5 text-[12.5px] border ${
								backfillResult.imported > 0
									? "bg-green-500/5 border-green-200 text-green-700"
									: "bg-muted/50 border-border text-muted-foreground"
							}`}
						>
							<p className="font-medium">
								{backfillResult.imported > 0
									? `${backfillResult.imported} domain${backfillResult.imported !== 1 ? "s" : ""} imported`
									: "No new domains found"}
							</p>
							{backfillResult.existing > 0 && (
								<p className="mt-0.5 text-[12px]">{backfillResult.existing} already in emailflare</p>
							)}
						</div>
					)}

					{backfillError && (
						<p className="text-[12px] text-destructive flex items-center gap-1.5">
							<AlertCircle size={12} /> {backfillError}
						</p>
					)}

					<Button
						size="sm"
						variant="outline"
						className="h-8 text-[13px]"
						disabled={backfilling}
						onClick={handleBackfill}
					>
						{backfilling ? (
							<>
								<Loader2 size={13} className="animate-spin mr-1.5" />
								Scanning…
							</>
						) : (
							<>
								<Download size={13} className="mr-1.5" />
								Scan &amp; Import Domains
							</>
						)}
					</Button>
				</div>
			</section>
		</div>
	);
}
