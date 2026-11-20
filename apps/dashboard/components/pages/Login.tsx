"use client";

import React, { useState } from "react";
import Link from "next/link";
import { login } from "@/lib/api";
import { AuthHeading, AuthLayout } from "@/components/app/auth/AuthLayout";
import { FormError, PasswordField, SubmitButton, TextField } from "@/components/app/auth/fields";

export default function Login() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [otp, setOtp] = useState("");
	const [needsOtp, setNeedsOtp] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			await login(email, password, otp || undefined);
			window.location.href = "/inbox";
		} catch (err: unknown) {
			const code =
				err && typeof err === "object" && "response" in err
					? (err as { response?: { data?: { error?: string } } }).response?.data?.error
					: undefined;
			if (code === "totp_required") {
				setNeedsOtp(true);
				setError("Enter the code from your authenticator or a backup code.");
			} else {
				setError("Invalid email or password.");
			}
		} finally {
			setLoading(false);
		}
	}

	return (
		<AuthLayout
			eyebrow="Inbox dashboard"
			headline="Your inbox,"
			highlight="your CRM."
			description="Receive, manage, and reply to emails through a unified inbox — with sequences, templates, and multi-user collaboration."
			features={[
				"Unified inbox with thread view",
				"Automated email sequences",
				"Multi-user, invite-only access",
				"Full sending API built-in",
			]}
		>
			<AuthHeading title="Sign in" description="Enter your email and password to continue." />

			<form onSubmit={handleSubmit} className="flex flex-col gap-4">
				<TextField
					id="email"
					label="Email"
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
					placeholder="you@example.com"
					autoComplete="email"
					autoFocus
				/>
				<PasswordField
					id="password"
					label="Password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					placeholder="••••••••"
					autoComplete="current-password"
				/>
				{needsOtp && (
					<TextField
						id="otp"
						label="Authenticator code"
						value={otp}
						onChange={(e) => setOtp(e.target.value)}
						autoComplete="one-time-code"
						placeholder="123456"
					/>
				)}

				<FormError>{error}</FormError>

				<SubmitButton loading={loading} loadingLabel="Signing in…" disabled={!email.trim() || !password.trim()}>
					Sign in
				</SubmitButton>

				<div className="mt-2 flex items-center justify-between text-sm">
					<Link href="/forgot-password" className="font-medium text-primary hover:underline">
						Forgot password
					</Link>
					<Link href="/setup" className="text-muted-foreground hover:text-foreground">
						Set up workspace
					</Link>
				</div>
			</form>
		</AuthLayout>
	);
}
