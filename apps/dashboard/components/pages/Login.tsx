"use client";

import React, { useState } from "react";
import Link from "next/link";
import { login } from "@/lib/api";
import { AuthHeading, AuthLayout } from "@/components/app/auth/AuthLayout";
import { FormError, PasswordField, SubmitButton, TextField } from "@/components/app/auth/fields";
import { OtpInput } from "@/components/app/auth/OtpInput";
import { Button } from "@/components/ui/button";

export default function Login() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [otp, setOtp] = useState("");
	const [step, setStep] = useState<"credentials" | "otp">("credentials");
	const [useBackup, setUseBackup] = useState(false);

	async function signIn(code?: string) {
		setError("");
		setLoading(true);
		try {
			await login(email, password, code || undefined);
			window.location.href = "/inbox";
		} catch (err: unknown) {
			const response =
				err && typeof err === "object" && "response" in err
					? (err as { response?: { status?: number; data?: { error?: string } } }).response
					: undefined;
			if (response?.data?.error === "totp_required") {
				if (step === "credentials") {
					setStep("otp");
				} else {
					setError(useBackup ? "Invalid backup code." : "Invalid code. Try again.");
					setOtp("");
				}
			} else if (response?.status === 429 && response.data?.error) {
				setError(response.data.error);
				setOtp("");
			} else {
				setError("Invalid email or password.");
			}
		} finally {
			setLoading(false);
		}
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		void signIn(step === "otp" ? otp.trim() : undefined);
	}

	function backToCredentials() {
		setStep("credentials");
		setUseBackup(false);
		setOtp("");
		setError("");
	}

	function toggleBackup() {
		setUseBackup((v) => !v);
		setOtp("");
		setError("");
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
			{step === "credentials" ? (
				<>
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

						<FormError>{error}</FormError>

						<SubmitButton
							loading={loading}
							loadingLabel="Signing in…"
							disabled={!email.trim() || !password.trim()}
						>
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
				</>
			) : (
				<>
					<AuthHeading
						title="Two-factor authentication"
						description={
							useBackup
								? "Enter one of your backup codes."
								: `Enter the 6-digit code from your authenticator app for ${email}.`
						}
					/>

					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						{useBackup ? (
							<TextField
								id="backup-code"
								label="Backup code"
								value={otp}
								onChange={(e) => setOtp(e.target.value)}
								autoComplete="off"
								autoFocus
								disabled={loading}
								className="font-mono uppercase tracking-widest"
							/>
						) : (
							<OtpInput
								value={otp}
								onChange={setOtp}
								onComplete={(code) => void signIn(code)}
								disabled={loading}
								invalid={!!error}
								autoFocus
							/>
						)}

						<FormError>{error}</FormError>

						<SubmitButton
							loading={loading}
							loadingLabel="Verifying…"
							disabled={useBackup ? !otp.trim() : otp.length < 6}
						>
							Verify
						</SubmitButton>

						<div className="mt-2 flex items-center justify-between text-sm">
							<Button type="button" variant="link" size="sm" onClick={backToCredentials} className="px-0">
								Back to sign in
							</Button>
							<Button
								type="button"
								variant="link"
								size="sm"
								onClick={toggleBackup}
								className="px-0 text-muted-foreground"
							>
								{useBackup ? "Use authenticator code" : "Use a backup code"}
							</Button>
						</div>
					</form>
				</>
			)}
		</AuthLayout>
	);
}
