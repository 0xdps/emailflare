"use client";

import React, { useState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthCentered, AuthHeading } from "@/components/app/auth/AuthLayout";
import { FormError, SubmitButton, TextField } from "@/components/app/auth/fields";

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
		<AuthCentered>
			<AuthHeading
				title="Reset password"
				description="Enter the email on the account. If it can receive mail, a link arrives within a few minutes."
			/>
			<form onSubmit={handleSubmit} className="flex flex-col gap-4">
				<TextField
					id="email"
					label="Email"
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
					autoFocus
					autoComplete="email"
				/>
				{message && (
					<Alert variant="success">
						<AlertDescription>{message}</AlertDescription>
					</Alert>
				)}
				<FormError>{error}</FormError>
				<SubmitButton loading={loading} loadingLabel="Sending…" disabled={!email.trim()}>
					Send reset link
				</SubmitButton>
			</form>
			<p className="mt-4 text-sm">
				<Link href="/login" className="font-medium text-primary hover:underline">
					Back to sign in
				</Link>
			</p>
		</AuthCentered>
	);
}
