"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { resetPassword } from "@/lib/api";

export default function ResetPassword() {
	const params = useSearchParams();
	const token = params.get("token") ?? "";
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState("");
	const [done, setDone] = useState(false);
	const [loading, setLoading] = useState(false);

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
		if (!token) {
			setError("This reset link is missing its token.");
			return;
		}
		setLoading(true);
		try {
			await resetPassword(token, password);
			setDone(true);
		} catch {
			setError("This reset link is invalid or expired.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen grid place-items-center bg-background px-6">
			<div className="w-full max-w-[360px]">
				<h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
				{done ? (
					<p className="mt-3 text-[13px] text-muted-foreground">
						Password updated.{" "}
						<Link href="/login" className="text-orange-500 hover:text-orange-600">
							Sign in
						</Link>
					</p>
				) : (
					<form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
						<label className="flex flex-col gap-1.5 text-[12.5px] font-medium">
							New password
							<input
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								autoFocus
								autoComplete="new-password"
								className="h-9 rounded-md border bg-background px-3 text-[13px] font-normal outline-none focus:border-orange-400"
							/>
						</label>
						<label className="flex flex-col gap-1.5 text-[12.5px] font-medium">
							Confirm password
							<input
								type="password"
								value={confirm}
								onChange={(e) => setConfirm(e.target.value)}
								required
								autoComplete="new-password"
								className="h-9 rounded-md border bg-background px-3 text-[13px] font-normal outline-none focus:border-orange-400"
							/>
						</label>
						{error && <p className="text-[12px] text-destructive">{error}</p>}
						<button
							type="submit"
							disabled={loading}
							className="flex h-9 items-center justify-center gap-2 rounded-md bg-orange-500 text-[13px] font-semibold text-white hover:bg-orange-600 disabled:opacity-40"
						>
							{loading && <Loader2 size={13} className="animate-spin" />}
							Update password
						</button>
					</form>
				)}
			</div>
		</div>
	);
}
