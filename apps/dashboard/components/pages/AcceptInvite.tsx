"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getInvite, acceptInvite } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthCentered, AuthHeading } from "@/components/app/auth/AuthLayout";
import { FormError, PasswordField, SubmitButton, TextField } from "@/components/app/auth/fields";

export default function AcceptInvite({ token }: { token: string }) {
	const router = useRouter();

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
			router.replace("/inbox");
		} catch (err: unknown) {
			const msg =
				err && typeof err === "object" && "response" in err
					? (err as { response?: { data?: { error?: string } } }).response?.data?.error
					: undefined;
			if (msg === "invite_expired") setError("This invite has expired.");
			else if (msg === "invite_not_found") setError("Invite not found or already used.");
			else setError("Something went wrong. Please try again.");
		} finally {
			setLoading(false);
		}
	}

	if (notFound) {
		return (
			<AuthCentered>
				<AuthHeading
					title="Invite unavailable"
					description="This invite link is invalid or has already been used."
				/>
			</AuthCentered>
		);
	}

	if (!inviteEmail) {
		return (
			<AuthCentered wide>
				<div className="flex flex-col gap-4">
					<Skeleton className="h-6 w-40" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
				</div>
			</AuthCentered>
		);
	}

	return (
		<AuthCentered wide>
			<AuthHeading
				title="Accept invite"
				description={
					<>
						You were invited as <span className="font-medium text-foreground">{inviteEmail}</span>. Create
						your account to continue.
					</>
				}
			/>

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
				<TextField id="invite-email" label="Email" value={inviteEmail} disabled readOnly />
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

				<FormError>{error}</FormError>

				<SubmitButton
					loading={loading}
					loadingLabel="Creating account…"
					disabled={!name.trim() || !password || !confirm}
				>
					Create account
				</SubmitButton>
			</form>
		</AuthCentered>
	);
}
