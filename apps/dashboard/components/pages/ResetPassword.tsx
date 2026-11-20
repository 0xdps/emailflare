"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/api";
import { AuthCentered, AuthHeading } from "@/components/app/auth/AuthLayout";
import { FormError, PasswordField, SubmitButton } from "@/components/app/auth/fields";

export default function ResetPassword() {
	const params = useSearchParams();
	const token = params.get("token") ?? "";
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState("");
	const [done, setDone] = useState(false);
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
		<AuthCentered>
			<AuthHeading title="Choose a new password" />
			{done ? (
				<p className="text-sm text-muted-foreground">
					Password updated.{" "}
					<Link href="/login" className="font-medium text-primary hover:underline">
						Sign in
					</Link>
				</p>
			) : (
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<PasswordField
						id="password"
						label="New password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						autoFocus
						autoComplete="new-password"
						visible={showPw}
						onVisibleChange={setShowPw}
					/>
					<PasswordField
						id="confirm"
						label="Confirm password"
						value={confirm}
						onChange={(e) => setConfirm(e.target.value)}
						required
						autoComplete="new-password"
						visible={showPw}
						onVisibleChange={setShowPw}
					/>
					<FormError>{error}</FormError>
					<SubmitButton loading={loading} loadingLabel="Updating…">
						Update password
					</SubmitButton>
				</form>
			)}
		</AuthCentered>
	);
}
