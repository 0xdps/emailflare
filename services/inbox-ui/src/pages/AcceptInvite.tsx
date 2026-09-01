import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { getInvite, acceptInvite } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

function AppLogo({ size = 30 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 64 64" fill="none">
			<defs>
				<linearGradient id="inv-bg" x1="0" y1="1" x2="1" y2="0">
					<stop offset="0%" stopColor="#9a3412" />
					<stop offset="58%" stopColor="#ea580c" />
					<stop offset="100%" stopColor="#fb923c" />
				</linearGradient>
			</defs>
			<rect width="64" height="64" rx="13" fill="url(#inv-bg)" />
			<path d="M53 11 L9 28 L23 38 Z" fill="white" />
			<path d="M53 11 L23 38 L9 53 Z" fill="white" opacity="0.82" />
		</svg>
	);
}

export default function AcceptInvite() {
	const { token } = useParams({ from: "/invite/$token" });
	const navigate = useNavigate();

	const [inviteEmail, setInviteEmail] = useState("");
	const [name, setName] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [showPw, setShowPw] = useState(false);
	const [notFound, setNotFound] = useState(false);

	useEffect(() => {
		if (!token) return;
		getInvite(token)
			.then(({ email }) => setInviteEmail(email))
			.catch(() => setNotFound(true));
	}, [token]);

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
			await acceptInvite(token, name.trim(), password);
			navigate({ to: "/inbox" });
		} catch (err: any) {
			const msg = err?.response?.data?.error;
			if (msg === "invite_expired") setError("This invite has expired.");
			else if (msg === "invite_not_found") setError("Invite not found or already used.");
			else setError("Something went wrong. Please try again.");
		} finally {
			setLoading(false);
		}
	}

	if (notFound) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background px-6">
				<div className="text-center">
					<p className="text-sm text-muted-foreground">
						This invite link is invalid or has already been used.
					</p>
				</div>
			</div>
		);
	}

	if (!inviteEmail) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<Loader2 size={20} className="animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-background px-6">
			<div className="w-full max-w-[400px]">
				<div className="flex items-center gap-2.5 mb-8">
					<AppLogo size={30} />
					<span className="text-[15px] font-semibold text-foreground tracking-tight">EmailFlare</span>
				</div>

				<div className="mb-7">
					<h2 className="text-xl font-semibold text-foreground tracking-tight">Accept invite</h2>
					<p className="text-sm text-muted-foreground mt-1">
						You were invited as <span className="font-medium text-foreground">{inviteEmail}</span>. Create
						your account to continue.
					</p>
				</div>

				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="name">Full name</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
							placeholder="Jane Smith"
							autoFocus
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<Label>Email</Label>
						<Input value={inviteEmail} disabled className="opacity-60" />
					</div>

					<div className="flex flex-col gap-1.5">
						<Label htmlFor="password">Password</Label>
						<div className="relative">
							<Input
								id="password"
								type={showPw ? "text" : "password"}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								minLength={8}
								className="pr-10"
								placeholder="Min 8 characters"
								autoComplete="new-password"
							/>
							<button
								type="button"
								onClick={() => setShowPw((v) => !v)}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
								tabIndex={-1}
							>
								{showPw ? <EyeOff size={14} /> : <Eye size={14} />}
							</button>
						</div>
					</div>

					<div className="flex flex-col gap-1.5">
						<Label htmlFor="confirm">Confirm password</Label>
						<Input
							id="confirm"
							type={showPw ? "text" : "password"}
							value={confirm}
							onChange={(e) => setConfirm(e.target.value)}
							required
							placeholder="Re-enter password"
							autoComplete="new-password"
						/>
					</div>

					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<Button
						type="submit"
						disabled={loading || !name.trim() || !password || !confirm}
						className="w-full"
					>
						{loading && <Loader2 size={14} className="animate-spin" data-icon="inline-start" />}
						{loading ? "Creating account…" : "Create account"}
					</Button>
				</form>
			</div>
		</div>
	);
}
