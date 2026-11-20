"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
	Shield,
	ShieldCheck,
	QrCode,
	Key,
	Lock,
	Eye,
	EyeOff,
	Copy,
	Check,
	Download,
	Smartphone,
	AlertCircle,
	CheckCircle2,
	Loader2,
} from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SecurityPage() {
	const [enabled, setEnabled] = useState(false);
	const [loading, setLoading] = useState(true);
	const [settingUp, setSettingUp] = useState(false);
	const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
	const [uri, setUri] = useState("");
	const [secret, setSecret] = useState("");
	const [code, setCode] = useState("");
	const [backupCodes, setBackupCodes] = useState<string[]>([]);
	const [error, setError] = useState("");
	const [copiedSecret, setCopiedSecret] = useState(false);
	const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);
	const [showManualKey, setShowManualKey] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [disabling, setDisabling] = useState(false);

	// Password change state
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [changingPassword, setChangingPassword] = useState(false);
	const [passwordError, setPasswordError] = useState("");
	const [passwordSuccess, setPasswordSuccess] = useState("");
	const [showCurrentPassword, setShowCurrentPassword] = useState(false);
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	async function handleChangePassword(e: React.FormEvent) {
		e.preventDefault();
		setPasswordError("");
		setPasswordSuccess("");

		if (!currentPassword) {
			setPasswordError("Current password is required.");
			return;
		}

		if (newPassword.length < 8) {
			setPasswordError("New password must be at least 8 characters.");
			return;
		}

		if (newPassword !== confirmPassword) {
			setPasswordError("New passwords do not match.");
			return;
		}

		if (currentPassword === newPassword) {
			setPasswordError("New password cannot be the same as your current password.");
			return;
		}

		setChangingPassword(true);
		try {
			await api.post("/api/auth/change-password", {
				currentPassword,
				newPassword,
			});
			setPasswordSuccess("Your password has been updated successfully.");
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
		} catch (err: any) {
			setPasswordError(
				err?.response?.data?.error || "Failed to update password. Please check your current password.",
			);
		} finally {
			setChangingPassword(false);
		}
	}

	useEffect(() => {
		api.get<{ enabled: boolean }>("/api/auth/totp/status")
			.then((res) => setEnabled(res.data.enabled))
			.catch(() => setEnabled(false))
			.finally(() => setLoading(false));
	}, []);

	async function startSetup() {
		setError("");
		setSettingUp(true);
		try {
			const { data } = await api.post<{ secret: string; uri: string }>("/api/auth/totp/setup");
			setSecret(data.secret);
			setUri(data.uri);

			// Generate crisp QR code data URL
			const url = await QRCode.toDataURL(data.uri, {
				margin: 1,
				width: 220,
				color: {
					dark: "#09090b", // zinc-900
					light: "#ffffff",
				},
				errorCorrectionLevel: "M",
			});
			setQrDataUrl(url);
		} catch (err: any) {
			setError(err?.response?.data?.error || "Failed to initialize authenticator setup.");
		} finally {
			setSettingUp(false);
		}
	}

	async function handleEnable(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setConfirming(true);
		try {
			const { data } = await api.post<{ backupCodes: string[] }>("/api/auth/totp/enable", {
				code: code.trim(),
			});
			setBackupCodes(data.backupCodes);
			setEnabled(true);
			setSecret("");
			setUri("");
			setQrDataUrl(null);
			setCode("");
		} catch (err: any) {
			setError(err?.response?.data?.error || "Invalid 6-digit code. Please try again.");
		} finally {
			setConfirming(false);
		}
	}

	async function handleDisable(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setDisabling(true);
		try {
			await api.post("/api/auth/totp/disable", { code: code.trim() });
			setEnabled(false);
			setCode("");
			setBackupCodes([]);
		} catch (err: any) {
			setError(err?.response?.data?.error || "Invalid code. Please try again.");
		} finally {
			setDisabling(false);
		}
	}

	function copyToClipboard(text: string, type: "secret" | "backup") {
		navigator.clipboard.writeText(text);
		if (type === "secret") {
			setCopiedSecret(true);
			setTimeout(() => setCopiedSecret(false), 2000);
		} else {
			setCopiedBackupCodes(true);
			setTimeout(() => setCopiedBackupCodes(false), 2000);
		}
	}

	function downloadBackupCodes() {
		const blob = new Blob([backupCodes.join("\n")], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "emailflare-backup-codes.txt";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	// Format secret into 4-char groups for readability: "ABCD EFGH IJKL MNOP"
	const formattedSecret = secret ? secret.match(/.{1,4}/g)?.join(" ") || secret : "";

	if (loading) {
		return (
			<div className="mx-auto max-w-xl p-6 md:p-8 flex items-center justify-center min-h-[300px]">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-xl space-y-6 p-6 md:p-8">
			{/* Page Header */}
			<div>
				<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Account security</p>
				<h1 className="mt-1 text-2xl font-semibold tracking-tight">Security Settings</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Manage your password, two-factor authentication, and account access.
				</p>
			</div>

			{/* Section 1: Change Password */}
			<div className="rounded-xl border border-border bg-card p-6 space-y-5">
				<div className="flex items-start gap-3.5">
					<div className="size-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
						<Key className="size-5" />
					</div>
					<div className="space-y-1">
						<h2 className="text-sm font-semibold text-foreground">Change password</h2>
						<p className="text-xs text-muted-foreground leading-relaxed">
							Update your sign-in password. Passwords must be at least 8 characters long.
						</p>
					</div>
				</div>

				<form onSubmit={handleChangePassword} className="space-y-4 pt-1 max-w-md">
					{/* Current Password */}
					<div className="space-y-1.5">
						<label className="text-xs font-medium text-foreground">Current password</label>
						<div className="relative">
							<Input
								type={showCurrentPassword ? "text" : "password"}
								value={currentPassword}
								onChange={(e) => setCurrentPassword(e.target.value)}
								placeholder="Enter your current password"
								className="pr-10 h-9 text-xs"
								autoComplete="current-password"
								required
							/>
							<button
								type="button"
								onClick={() => setShowCurrentPassword((v) => !v)}
								className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
								tabIndex={-1}
							>
								{showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
							</button>
						</div>
					</div>

					{/* New Password */}
					<div className="space-y-1.5">
						<label className="text-xs font-medium text-foreground">New password</label>
						<div className="relative">
							<Input
								type={showNewPassword ? "text" : "password"}
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								placeholder="At least 8 characters"
								minLength={8}
								className="pr-10 h-9 text-xs"
								autoComplete="new-password"
								required
							/>
							<button
								type="button"
								onClick={() => setShowNewPassword((v) => !v)}
								className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
								tabIndex={-1}
							>
								{showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
							</button>
						</div>
					</div>

					{/* Confirm New Password */}
					<div className="space-y-1.5">
						<label className="text-xs font-medium text-foreground">Confirm new password</label>
						<div className="relative">
							<Input
								type={showConfirmPassword ? "text" : "password"}
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								placeholder="Re-enter your new password"
								minLength={8}
								className="pr-10 h-9 text-xs"
								autoComplete="new-password"
								required
							/>
							<button
								type="button"
								onClick={() => setShowConfirmPassword((v) => !v)}
								className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
								tabIndex={-1}
							>
								{showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
							</button>
						</div>
					</div>

					{/* Password Messages */}
					{passwordError && (
						<div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-xs">
							<AlertCircle className="size-4 shrink-0" />
							<p>{passwordError}</p>
						</div>
					)}

					{passwordSuccess && (
						<div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
							<CheckCircle2 className="size-4 shrink-0" />
							<p>{passwordSuccess}</p>
						</div>
					)}

					<Button
						type="submit"
						size="sm"
						disabled={changingPassword || !currentPassword || newPassword.length < 8 || !confirmPassword}
						className="h-9 px-4 bg-orange-600 hover:bg-orange-700 text-white"
					>
						{changingPassword ? <Loader2 className="size-3.5 animate-spin" /> : "Update password"}
					</Button>
				</form>
			</div>

			{/* Section 2: Two-Factor Authentication */}
			<div>
				<h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
					Two-Factor Authentication
				</h2>
			</div>

			{/* Status Card: Enabled State */}
			{enabled ? (
				<div className="space-y-6">
					<div className="rounded-xl border border-border bg-card p-5 space-y-4">
						<div className="flex items-start gap-3.5">
							<div className="size-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
								<ShieldCheck className="size-5" />
							</div>
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<h2 className="text-sm font-semibold text-foreground">
										Authenticator app is active
									</h2>
									<span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
										<span className="size-1.5 rounded-full bg-emerald-500" />
										Protected
									</span>
								</div>
								<p className="text-xs text-muted-foreground leading-relaxed">
									Your account requires a 6-digit one-time code from your authenticator app whenever
									you sign in.
								</p>
							</div>
						</div>

						{/* Backup Codes Display (shown right after activation) */}
						{backupCodes.length > 0 && (
							<div className="mt-4 pt-4 border-t border-border/80 space-y-3">
								<div className="flex items-center justify-between">
									<div>
										<h3 className="text-xs font-semibold text-foreground">
											Save your backup codes
										</h3>
										<p className="text-[11px] text-muted-foreground">
											Each code can only be used once if you lose access to your device.
										</p>
									</div>
									<div className="flex items-center gap-1.5">
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="h-7 text-xs gap-1.5"
											onClick={() => copyToClipboard(backupCodes.join("\n"), "backup")}
										>
											{copiedBackupCodes ? (
												<Check className="size-3 text-emerald-500" />
											) : (
												<Copy className="size-3" />
											)}
											<span>{copiedBackupCodes ? "Copied" : "Copy"}</span>
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="h-7 text-xs gap-1.5"
											onClick={downloadBackupCodes}
										>
											<Download className="size-3" />
											<span>Download</span>
										</Button>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-2 bg-muted/40 p-3.5 rounded-lg border border-border/60 font-mono text-xs text-center select-all">
									{backupCodes.map((c, i) => (
										<div
											key={i}
											className="py-1 px-2 rounded bg-background/60 border border-border/40 text-foreground"
										>
											{c}
										</div>
									))}
								</div>
							</div>
						)}
					</div>

					{/* Turn Off Form */}
					<div className="rounded-xl border border-border/80 bg-card p-5 space-y-3">
						<h2 className="text-sm font-semibold text-foreground">Disable two-factor authentication</h2>
						<p className="text-xs text-muted-foreground">
							Enter the current 6-digit code from your authenticator app to turn off 2FA.
						</p>

						<form onSubmit={handleDisable} className="space-y-3 pt-1">
							<div className="flex items-center gap-2 max-w-xs">
								<Input
									value={code}
									onChange={(e) => setCode(e.target.value)}
									placeholder="000000"
									maxLength={8}
									inputMode="numeric"
									autoComplete="one-time-code"
									className="h-9 font-mono text-sm tracking-widest text-center"
									required
								/>
								<Button
									type="submit"
									variant="destructive"
									size="sm"
									className="h-9 shrink-0"
									disabled={disabling || code.trim().length < 6}
								>
									{disabling ? <Loader2 className="size-3.5 animate-spin" /> : "Turn off"}
								</Button>
							</div>
						</form>
					</div>
				</div>
			) : (
				/* Setup State */
				<div className="rounded-xl border border-border bg-card p-6 space-y-6">
					{!secret ? (
						<div className="space-y-4">
							<div className="flex items-start gap-3.5">
								<div className="size-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
									<Smartphone className="size-5" />
								</div>
								<div className="space-y-1">
									<h2 className="text-sm font-semibold text-foreground">Authenticator App (TOTP)</h2>
									<p className="text-xs text-muted-foreground leading-relaxed">
										Secure your account with Google Authenticator, 1Password, Apple Passwords,
										Authy, or any standard TOTP app.
									</p>
								</div>
							</div>

							<Button
								size="sm"
								onClick={startSetup}
								disabled={settingUp}
								className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
							>
								{settingUp ? (
									<Loader2 className="size-3.5 animate-spin" />
								) : (
									<QrCode className="size-4" />
								)}
								<span>Set up authenticator</span>
							</Button>
						</div>
					) : (
						<div className="space-y-6">
							{/* Step 1: Scan QR Code */}
							<div className="space-y-3">
								<div className="flex items-center gap-2">
									<span className="flex items-center justify-center size-5 rounded-full bg-orange-500/10 text-orange-600 text-xs font-semibold">
										1
									</span>
									<h2 className="text-sm font-semibold text-foreground">Scan the QR code</h2>
								</div>
								<p className="text-xs text-muted-foreground">
									Open your authenticator app (Google Authenticator, 1Password, Apple Passwords,
									Authy) and scan the QR code below.
								</p>

								{/* QR Code Container */}
								<div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-xl border border-border/80">
									{qrDataUrl ? (
										<div className="p-3 bg-white rounded-xl shadow-sm border border-zinc-200">
											<img
												src={qrDataUrl}
												alt="Authenticator setup QR code"
												className="size-48 rounded"
												width={192}
												height={192}
											/>
										</div>
									) : (
										<div className="size-48 flex items-center justify-center">
											<Loader2 className="size-6 animate-spin text-muted-foreground" />
										</div>
									)}

									{/* Secret Key Toggle / Copy */}
									<div className="mt-4 w-full max-w-sm text-center">
										<button
											type="button"
											onClick={() => setShowManualKey((v) => !v)}
											className="text-[11px] text-muted-foreground hover:text-foreground font-medium underline underline-offset-4 transition-colors"
										>
											{showManualKey ? "Hide manual setup key" : "Can't scan? Enter key manually"}
										</button>

										{showManualKey && (
											<div className="mt-3 p-3 bg-background rounded-lg border border-border/80 text-left space-y-2">
												<div className="flex items-center justify-between">
													<span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
														Secret key
													</span>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
														onClick={() => copyToClipboard(secret, "secret")}
													>
														{copiedSecret ? (
															<Check className="size-3 text-emerald-500" />
														) : (
															<Copy className="size-3" />
														)}
														<span>{copiedSecret ? "Copied" : "Copy"}</span>
													</Button>
												</div>
												<p className="font-mono text-xs font-semibold tracking-wider text-foreground break-all select-all">
													{formattedSecret}
												</p>
											</div>
										)}
									</div>
								</div>
							</div>

							{/* Step 2: Verification Code Form */}
							<form onSubmit={handleEnable} className="space-y-4 pt-2 border-t border-border/80">
								<div className="flex items-center gap-2">
									<span className="flex items-center justify-center size-5 rounded-full bg-orange-500/10 text-orange-600 text-xs font-semibold">
										2
									</span>
									<h2 className="text-sm font-semibold text-foreground">Verify the code</h2>
								</div>
								<p className="text-xs text-muted-foreground">
									Enter the 6-digit confirmation code shown in your authenticator app.
								</p>

								<div className="flex items-center gap-2.5 max-w-xs">
									<Input
										value={code}
										onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
										placeholder="123456"
										maxLength={6}
										inputMode="numeric"
										autoComplete="one-time-code"
										autoFocus
										className="h-10 font-mono text-base tracking-widest text-center font-medium"
										required
									/>
									<Button
										type="submit"
										size="sm"
										className="h-10 px-4 bg-orange-600 hover:bg-orange-700 text-white shrink-0"
										disabled={confirming || code.trim().length !== 6}
									>
										{confirming ? (
											<Loader2 className="size-3.5 animate-spin" />
										) : (
											"Confirm & Activate"
										)}
									</Button>
								</div>
							</form>
						</div>
					)}
				</div>
			)}

			{/* Error Alert */}
			{error && (
				<div className="flex items-center gap-2.5 p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-xs">
					<AlertCircle className="size-4 shrink-0" />
					<p>{error}</p>
				</div>
			)}
		</div>
	);
}
