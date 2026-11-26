"use client";

import React, { useEffect, useState } from "react";
import { getSetupStatus, setup } from "@/lib/api";
import { AuthHeading, AuthLayout } from "@/components/app/auth/AuthLayout";
import { FormError, PasswordField, SubmitButton, TextField } from "@/components/app/auth/fields";

export default function Setup() {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [showPw, setShowPw] = useState(false);
	const [requiresToken, setRequiresToken] = useState(false);
	const [setupToken, setSetupToken] = useState("");

	useEffect(() => {
		getSetupStatus()
			.then((status) => setRequiresToken(!!status.requiresToken))
			.catch(() => undefined);
	}, []);

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
			await setup(name.trim(), email.trim(), password, setupToken.trim());
			window.location.href = "/setup/ready";
		} catch (err: unknown) {
			const msg =
				err && typeof err === "object" && "response" in err
					? (err as { response?: { data?: { error?: string } } }).response?.data?.error
					: undefined;
			setError(
				msg === "already_initialized"
					? "Inbox is already set up."
					: msg === "invalid_setup_token"
						? "That setup token is not correct."
						: "Setup failed. Please try again.",
			);
		} finally {
			setLoading(false);
		}
	}

	return (
		<AuthLayout
			eyebrow="First-run setup"
			headline="Set up your"
			highlight="workspace."
			description="Create the admin account. Once set up, additional members are added by invite only — there is no open signup."
		>
			<AuthHeading title="Create admin account" description="This runs once — no open signup after setup." />

			<form onSubmit={handleSubmit} className="flex flex-col gap-4">
				<TextField
					id="name"
					label="Full name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					required
					placeholder="Jane Smith"
					autoFocus
				/>
				<TextField
					id="email"
					label="Email"
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
					placeholder="jane@example.com"
					autoComplete="email"
				/>
				<PasswordField
					id="password"
					label="Password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					minLength={8}
					placeholder="Min 8 characters"
					autoComplete="new-password"
					visible={showPw}
					onVisibleChange={setShowPw}
				/>
				<TextField
					id="confirm"
					label="Confirm password"
					type={showPw ? "text" : "password"}
					value={confirm}
					onChange={(e) => setConfirm(e.target.value)}
					required
					placeholder="Re-enter password"
					autoComplete="new-password"
				/>

				{requiresToken && (
					<TextField
						id="setup-token"
						label="Setup token"
						value={setupToken}
						onChange={(e) => setSetupToken(e.target.value)}
						required
						placeholder="The SETUP_TOKEN secret of this Worker"
						autoComplete="off"
					/>
				)}

				<FormError>{error}</FormError>

				<SubmitButton
					loading={loading}
					loadingLabel="Creating account…"
					disabled={
						!name.trim() || !email.trim() || !password || !confirm || (requiresToken && !setupToken.trim())
					}
				>
					Create admin account
				</SubmitButton>
			</form>
		</AuthLayout>
	);
}
