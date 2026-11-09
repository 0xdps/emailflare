"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { forgotPassword } from "@/lib/api";

export default function ForgotPassword() {
	const [email, setEmail] = useState("");
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setMessage("");
		setLoading(true);
		try {
			setMessage(await forgotPassword(email.trim()));
		} catch {
			setError("Could not send a reset link. Try again in a minute.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen grid place-items-center bg-background px-6">
			<div className="w-full max-w-[360px]">
				<h1 className="text-xl font-semibold tracking-tight">Reset password</h1>
				<p className="mt-1 text-[13px] text-muted-foreground">
					Enter the email on the account. If it can receive mail, a link arrives within a few minutes.
				</p>
				<form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
					<label className="flex flex-col gap-1.5 text-[12.5px] font-medium">
						Email
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							autoFocus
							autoComplete="email"
							className="h-9 rounded-md border bg-background px-3 text-[13px] font-normal outline-none focus:border-orange-400"
						/>
					</label>
					{message && <p className="rounded-md border bg-muted px-3 py-2 text-[12px]">{message}</p>}
					{error && <p className="text-[12px] text-destructive">{error}</p>}
					<button
						type="submit"
						disabled={loading || !email.trim()}
						className="flex h-9 items-center justify-center gap-2 rounded-md bg-orange-500 text-[13px] font-semibold text-white hover:bg-orange-600 disabled:opacity-40"
					>
						{loading && <Loader2 size={13} className="animate-spin" />}
						Send reset link
					</button>
				</form>
				<p className="mt-4 text-[12px]">
					<Link href="/login" className="text-orange-500 hover:text-orange-600">
						Back to sign in
					</Link>
				</p>
			</div>
		</div>
	);
}
