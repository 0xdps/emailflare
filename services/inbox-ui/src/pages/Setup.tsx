import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { setup } from "../api";

function AppLogo({ size = 28 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 64 64" fill="none">
			<defs>
				<linearGradient id="setup-bg" x1="0" y1="1" x2="1" y2="0">
					<stop offset="0%" stopColor="#9a3412" />
					<stop offset="58%" stopColor="#ea580c" />
					<stop offset="100%" stopColor="#fb923c" />
				</linearGradient>
			</defs>
			<rect width="64" height="64" rx="13" fill="url(#setup-bg)" />
			<path d="M53 11 L9 28 L23 38 Z" fill="white" />
			<path d="M53 11 L23 38 L9 53 Z" fill="white" opacity="0.82" />
		</svg>
	);
}

export default function Setup() {
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [showPw, setShowPw] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		if (password.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}
		if (password !== confirm) {
			setError("Passwords do not match.");
			return;
		}
		setLoading(true);
		try {
			await setup(name.trim(), email.trim(), password);
			navigate({ to: "/inbox" });
		} catch (err: any) {
			const msg = err?.response?.data?.error;
			setError(msg === "already_initialized" ? "Inbox is already set up." : "Setup failed. Please try again.");
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
						First-run setup
					</p>
					<h1 className="text-[32px] font-bold text-white leading-tight mb-4">
						Set up your
						<br />
						<span className="text-orange-400">workspace.</span>
					</h1>
					<p className="text-[13.5px] text-zinc-400 leading-relaxed max-w-[300px]">
						Create the admin account. Once set up, additional members are added by invite only — there is no
						open signup.
					</p>
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
						<h2 className="text-xl font-semibold text-zinc-900 tracking-tight">Create admin account</h2>
						<p className="text-[13px] text-zinc-400 mt-1">This runs once — no open signup after setup.</p>
					</div>

					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						<div className="flex flex-col gap-1.5">
							<label htmlFor="name" className="text-[12.5px] font-medium text-zinc-700">
								Full name
							</label>
							<input
								id="name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								placeholder="Jane Smith"
								autoFocus
								className="h-9 px-3 rounded-md border border-zinc-200 bg-white text-[13px] text-zinc-900
                  placeholder:text-zinc-400 outline-none focus:border-orange-400 focus:ring-2
                  focus:ring-orange-100 transition-colors"
							/>
						</div>

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
								placeholder="jane@example.com"
								autoComplete="email"
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
									type={showPw ? "text" : "password"}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
									minLength={8}
									placeholder="Min 8 characters"
									autoComplete="new-password"
									className="w-full h-9 px-3 pr-9 rounded-md border border-zinc-200 bg-white text-[13px] text-zinc-900
                    placeholder:text-zinc-400 outline-none focus:border-orange-400 focus:ring-2
                    focus:ring-orange-100 transition-colors"
								/>
								<button
									type="button"
									onClick={() => setShowPw((v) => !v)}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
									tabIndex={-1}
									aria-label={showPw ? "Hide password" : "Show password"}
								>
									{showPw ? <EyeOff size={14} /> : <Eye size={14} />}
								</button>
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							<label htmlFor="confirm" className="text-[12.5px] font-medium text-zinc-700">
								Confirm password
							</label>
							<input
								id="confirm"
								type={showPw ? "text" : "password"}
								value={confirm}
								onChange={(e) => setConfirm(e.target.value)}
								required
								placeholder="Re-enter password"
								autoComplete="new-password"
								className="h-9 px-3 rounded-md border border-zinc-200 bg-white text-[13px] text-zinc-900
                  placeholder:text-zinc-400 outline-none focus:border-orange-400 focus:ring-2
                  focus:ring-orange-100 transition-colors"
							/>
						</div>

						{error && (
							<p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
								{error}
							</p>
						)}

						<button
							type="submit"
							disabled={loading || !name.trim() || !email.trim() || !password || !confirm}
							className="h-9 w-full rounded-md bg-orange-500 text-white text-[13px] font-semibold
                hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors
                flex items-center justify-center gap-2 mt-1"
						>
							{loading && <Loader2 size={13} className="animate-spin" />}
							{loading ? "Creating account…" : "Create admin account"}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
