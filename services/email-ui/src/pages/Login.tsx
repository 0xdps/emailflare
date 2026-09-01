import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import api from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Login() {
	const navigate = useNavigate();
	const [token, setTokenInput] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [showToken, setShowToken] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			await api.post("/api/auth/login", { token });
			navigate({ to: "/" });
		} catch {
			setError("Invalid admin token. Check your ADMIN_TOKEN environment variable.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen flex bg-background">
			{/* Left panel — brand/product info */}
			<div className="hidden lg:flex w-[420px] flex-shrink-0 flex-col justify-between bg-sidebar border-r border-sidebar-border p-10">
				<div className="flex items-center gap-2.5">
					<svg width="30" height="30" viewBox="0 0 64 64" fill="none">
						<defs>
							<linearGradient id="lg-bg" x1="0" y1="1" x2="1" y2="0">
								<stop offset="0%" stopColor="#9a3412" />
								<stop offset="58%" stopColor="#ea580c" />
								<stop offset="100%" stopColor="#fb923c" />
							</linearGradient>
						</defs>
						<rect width="64" height="64" rx="13" fill="url(#lg-bg)" />
						<path d="M53 11 L9 28 L23 38 Z" fill="white" />
						<path d="M53 11 L23 38 L9 53 Z" fill="white" opacity="0.82" />
					</svg>
					<span className="text-[15px] font-semibold text-foreground tracking-tight">EmailFlare</span>
				</div>

				<div>
					<h1 className="text-3xl font-bold text-foreground leading-tight mb-4">
						Transactional email,
						<br />
						<span className="text-primary">built for developers.</span>
					</h1>
					<p className="text-sm text-muted-foreground leading-relaxed mb-8">
						Send, track, and manage emails at scale through Cloudflare Email Routing — with templates, API
						keys, and detailed delivery logs.
					</p>

					<div className="flex flex-col gap-3">
						{[
							"Cloudflare-native email routing",
							"Template engine with variable substitution",
							"Per-key rate limiting & usage tracking",
							"Real-time delivery logs & analytics",
						].map((f) => (
							<div key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground">
								<span className="size-1 rounded-full bg-primary flex-shrink-0" />
								{f}
							</div>
						))}
					</div>
				</div>

				<p className="text-xs text-muted-foreground/40">Powered by Cloudflare Workers &amp; D1</p>
			</div>

			{/* Right panel — login form */}
			<div className="flex-1 flex items-center justify-center px-6">
				<div className="w-full max-w-[360px]">
					{/* Mobile logo */}
					<div className="flex items-center gap-2 mb-8 lg:hidden">
						<svg width="28" height="28" viewBox="0 0 64 64" fill="none">
							<defs>
								<linearGradient id="lg-bg-mobile" x1="0" y1="1" x2="1" y2="0">
									<stop offset="0%" stopColor="#9a3412" />
									<stop offset="58%" stopColor="#ea580c" />
									<stop offset="100%" stopColor="#fb923c" />
								</linearGradient>
							</defs>
							<rect width="64" height="64" rx="13" fill="url(#lg-bg-mobile)" />
							<path d="M53 11 L9 28 L23 38 Z" fill="white" />
							<path d="M53 11 L23 38 L9 53 Z" fill="white" opacity="0.82" />
						</svg>
						<span className="text-[15px] font-semibold text-foreground tracking-tight">EmailFlare</span>
					</div>

					<div className="mb-7">
						<h2 className="text-xl font-semibold text-foreground tracking-tight">Sign in to admin</h2>
						<p className="text-sm text-muted-foreground mt-1">Enter your admin token to continue</p>
					</div>

					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="token">Admin token</Label>
							<div className="relative">
								<Input
									id="token"
									type={showToken ? "text" : "password"}
									value={token}
									onChange={(e) => setTokenInput(e.target.value)}
									required
									className="pr-10 font-mono"
									placeholder="ef_adm_••••••••••••••••"
									autoComplete="current-password"
									autoFocus
								/>
								<button
									type="button"
									onClick={() => setShowToken((v) => !v)}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
									tabIndex={-1}
									aria-label={showToken ? "Hide token" : "Show token"}
								>
									{showToken ? <EyeOff size={14} /> : <Eye size={14} />}
								</button>
							</div>
						</div>

						{error && (
							<Alert variant="destructive">
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}

						<Button type="submit" disabled={loading || !token.trim()} className="w-full">
							{loading && <Loader2 size={14} className="animate-spin" data-icon="inline-start" />}
							{loading ? "Signing in…" : "Sign in"}
						</Button>
					</form>

					<p className="text-[11px] text-muted-foreground/40 text-center mt-6">
						Token is set via <code className="font-mono">ADMIN_TOKEN</code> env var
					</p>
				</div>
			</div>
		</div>
	);
}
