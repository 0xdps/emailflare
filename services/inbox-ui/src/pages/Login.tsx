import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { login } from "../api";

function AppLogo({ size = 28 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 64 64" fill="none">
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
	);
}

export default function Login() {
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			await login(email, password);
			navigate({ to: "/inbox" });
		} catch {
			setError("Invalid email or password.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen flex bg-background">
			{/* ── Left panel ── */}
			<div className="hidden lg:flex w-[420px] shrink-0 flex-col justify-between bg-zinc-900 px-10 py-12">
				<div className="flex items-center gap-2.5">
					<AppLogo size={28} />
					<span className="text-[14px] font-semibold text-white/90 tracking-tight">EmailFlare</span>
				</div>

				<div>
					<p className="text-[11px] font-semibold text-orange-400 uppercase tracking-widest mb-4">
						Inbox dashboard
					</p>
					<h1 className="text-[32px] font-bold text-white leading-tight mb-4">
						Your inbox,
						<br />
						<span className="text-orange-400">your CRM.</span>
					</h1>
					<p className="text-[13.5px] text-zinc-400 leading-relaxed mb-8 max-w-[300px]">
						Receive, manage, and reply to emails through a unified inbox — with sequences, templates, and
						multi-user collaboration.
					</p>
					<div className="flex flex-col gap-3">
						{[
							"Unified inbox with thread view",
							"Automated email sequences",
							"Multi-user, invite-only access",
							"Full sending API built-in",
						].map((f) => (
							<div key={f} className="flex items-center gap-2.5 text-[13px] text-zinc-500">
								<span className="size-1 rounded-full bg-orange-500 shrink-0" />
								{f}
							</div>
						))}
					</div>
				</div>

				<p className="text-[11.5px] text-zinc-600">Powered by Cloudflare Workers &amp; D1</p>
			</div>

			{/* ── Right panel: form ── */}
			<div className="flex-1 flex items-center justify-center px-6">
				<div className="w-full max-w-[360px]">
					{/* Mobile logo */}
					<div className="flex items-center gap-2 mb-8 lg:hidden">
						<AppLogo size={26} />
						<span className="text-[14px] font-semibold text-foreground">EmailFlare</span>
					</div>

					<div className="mb-7">
						<h2 className="text-xl font-semibold text-zinc-900 tracking-tight">Sign in</h2>
						<p className="text-[13px] text-zinc-400 mt-1">Enter your email and password to continue.</p>
					</div>

					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						<div className="flex flex-col gap-1.5">
							<label htmlFor="email" className="text-[12.5px] font-medium text-zinc-700">
								Email
							</label>
							<input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								placeholder="you@example.com"
								autoComplete="email"
								autoFocus
								className="h-9 px-3 rounded-md border border-zinc-200 bg-white text-[13px] text-zinc-900
                  placeholder:text-zinc-400 outline-none focus:border-orange-400 focus:ring-2
                  focus:ring-orange-100 transition-colors"
							/>
						</div>

						<div className="flex flex-col gap-1.5">
							<label htmlFor="password" className="text-[12.5px] font-medium text-zinc-700">
								Password
							</label>
							<div className="relative">
								<input
									id="password"
									type={showPassword ? "text" : "password"}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
									placeholder="••••••••"
									autoComplete="current-password"
									className="w-full h-9 px-3 pr-9 rounded-md border border-zinc-200 bg-white text-[13px] text-zinc-900
                    placeholder:text-zinc-400 outline-none focus:border-orange-400 focus:ring-2
                    focus:ring-orange-100 transition-colors"
								/>
								<button
									type="button"
									onClick={() => setShowPassword((v) => !v)}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
									tabIndex={-1}
									aria-label={showPassword ? "Hide password" : "Show password"}
								>
									{showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
								</button>
							</div>
						</div>

						{error && (
							<p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
								{error}
							</p>
						)}

						<button
							type="submit"
							disabled={loading || !email.trim() || !password.trim()}
							className="h-9 w-full rounded-md bg-orange-500 text-white text-[13px] font-semibold
                hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors
                flex items-center justify-center gap-2 mt-1"
						>
							{loading && <Loader2 size={13} className="animate-spin" />}
							{loading ? "Signing in…" : "Sign in"}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
