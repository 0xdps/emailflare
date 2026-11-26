"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ShieldCheck, QrCode, Key, Copy, Check, Download, Smartphone, CheckCircle2, LogOut } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader, PageShell } from "@/components/app/PageHeader";
import { FormError, PasswordField } from "@/components/app/auth/fields";

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
	const [signingOut, setSigningOut] = useState(false);
	const [passwordError, setPasswordError] = useState("");
	const [passwordSuccess, setPasswordSuccess] = useState("");
	const [showCurrentPassword, setShowCurrentPassword] = useState(false);
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	async function handleSignOutEverywhere() {
		setSigningOut(true);
		try {
			await api.post("/api/auth/logout-all");
			window.location.href = "/login";
		} catch {
			toast.error("Could not sign out of all devices. Please try again.");
			setSigningOut(false);
		}
	}

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
		toast.success(type === "secret" ? "Secret key copied" : "Backup codes copied");
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
			<PageShell width="narrow">
				<div className="space-y-2">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-8 w-64" />
				</div>
				<Skeleton className="h-80 rounded-xl" />
				<Skeleton className="h-40 rounded-xl" />
			</PageShell>
		);
	}

	return (
		<PageShell width="narrow">
			<PageHeader
				eyebrow="Account security"
				title="Security Settings"
				description="Manage your password, two-factor authentication, and account access."
			/>

			{/* Section 1: Change Password */}
			<Card>
				<CardContent className="space-y-5">
					<div className="flex items-start gap-3.5">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary-muted-foreground">
							<Key className="size-5" />
						</div>
						<div className="space-y-1">
							<h2 className="text-sm font-semibold text-foreground">Change password</h2>
							<p className="text-xs leading-relaxed text-muted-foreground">
								Update your sign-in password. Passwords must be at least 8 characters long.
							</p>
						</div>
					</div>

					<form onSubmit={handleChangePassword} className="max-w-md space-y-4 pt-1">
						<PasswordField
							id="current-password"
							label="Current password"
							value={currentPassword}
							onChange={(e) => setCurrentPassword(e.target.value)}
							visible={showCurrentPassword}
							onVisibleChange={setShowCurrentPassword}
							placeholder="Enter your current password"
							autoComplete="current-password"
							required
						/>

						<PasswordField
							id="new-password"
							label="New password"
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
							visible={showNewPassword}
							onVisibleChange={setShowNewPassword}
							placeholder="At least 8 characters"
							minLength={8}
							autoComplete="new-password"
							required
						/>

						<PasswordField
							id="confirm-new-password"
							label="Confirm new password"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							visible={showConfirmPassword}
							onVisibleChange={setShowConfirmPassword}
							placeholder="Re-enter your new password"
							minLength={8}
							autoComplete="new-password"
							required
						/>

						<FormError>{passwordError}</FormError>

						{passwordSuccess && (
							<Alert variant="success">
								<CheckCircle2 />
								<AlertDescription className="text-success-muted-foreground">
									{passwordSuccess}
								</AlertDescription>
							</Alert>
						)}

						<Button
							type="submit"
							disabled={
								changingPassword || !currentPassword || newPassword.length < 8 || !confirmPassword
							}
						>
							{changingPassword ? <Spinner /> : "Update password"}
						</Button>
					</form>
				</CardContent>
			</Card>

			{/* Sessions */}
			<Card>
				<CardContent className="flex flex-wrap items-center justify-between gap-4">
					<div className="flex items-start gap-3.5">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary-muted-foreground">
							<LogOut className="size-5" />
						</div>
						<div className="space-y-1">
							<h2 className="text-sm font-semibold text-foreground">Sign out everywhere</h2>
							<p className="text-xs leading-relaxed text-muted-foreground">
								End every session on every device, including this one. Changing your password does the
								same for all other devices.
							</p>
						</div>
					</div>
					<Button variant="outline" onClick={handleSignOutEverywhere} disabled={signingOut}>
						{signingOut ? <Spinner /> : "Sign out of all devices"}
					</Button>
				</CardContent>
			</Card>

			{/* Section 2: Two-Factor Authentication */}
			<h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
				Two-Factor Authentication
			</h2>

			{/* Status Card: Enabled State */}
			{enabled ? (
				<div className="space-y-6">
					<Card>
						<CardContent className="space-y-4">
							<div className="flex items-start gap-3.5">
								<div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-muted text-success-muted-foreground">
									<ShieldCheck className="size-5" />
								</div>
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<h2 className="text-sm font-semibold text-foreground">
											Authenticator app is active
										</h2>
										<Badge variant="success">
											<span className="size-1.5 rounded-full bg-success" />
											Protected
										</Badge>
									</div>
									<p className="text-xs leading-relaxed text-muted-foreground">
										Your account requires a 6-digit one-time code from your authenticator app
										whenever you sign in.
									</p>
								</div>
							</div>

							{/* Backup Codes Display (shown right after activation) */}
							{backupCodes.length > 0 && (
								<div className="mt-4 space-y-3 border-t border-border pt-4">
									<div className="flex items-center justify-between gap-3">
										<div>
											<h3 className="text-xs font-semibold text-foreground">
												Save your backup codes
											</h3>
											<p className="text-2xs text-muted-foreground">
												Each code can only be used once if you lose access to your device.
											</p>
										</div>
										<div className="flex items-center gap-1.5">
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => copyToClipboard(backupCodes.join("\n"), "backup")}
											>
												{copiedBackupCodes ? <Check className="text-success" /> : <Copy />}
												<span>{copiedBackupCodes ? "Copied" : "Copy"}</span>
											</Button>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={downloadBackupCodes}
											>
												<Download />
												<span>Download</span>
											</Button>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 p-3.5 text-center font-mono text-xs select-all">
										{backupCodes.map((c, i) => (
											<div
												key={i}
												className="rounded border border-border bg-background/60 px-2 py-1 text-foreground"
											>
												{c}
											</div>
										))}
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Turn Off Form */}
					<Card>
						<CardContent className="space-y-3">
							<h2 className="text-sm font-semibold text-foreground">Disable two-factor authentication</h2>
							<p className="text-xs text-muted-foreground">
								Enter the current 6-digit code from your authenticator app to turn off 2FA.
							</p>

							<form onSubmit={handleDisable} className="space-y-3 pt-1">
								<div className="flex max-w-xs items-center gap-2">
									<Input
										value={code}
										onChange={(e) => setCode(e.target.value)}
										placeholder="000000"
										maxLength={8}
										inputMode="numeric"
										autoComplete="one-time-code"
										aria-label="Authenticator code"
										className="h-9 text-center font-mono text-sm tracking-widest"
										required
									/>
									<Button
										type="submit"
										variant="destructive"
										size="lg"
										className="shrink-0"
										disabled={disabling || code.trim().length < 6}
									>
										{disabling ? <Spinner /> : "Turn off"}
									</Button>
								</div>
							</form>
						</CardContent>
					</Card>
				</div>
			) : (
				/* Setup State */
				<Card>
					<CardContent className="space-y-6">
						{!secret ? (
							<div className="space-y-4">
								<div className="flex items-start gap-3.5">
									<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary-muted-foreground">
										<Smartphone className="size-5" />
									</div>
									<div className="space-y-1">
										<h2 className="text-sm font-semibold text-foreground">
											Authenticator App (TOTP)
										</h2>
										<p className="text-xs leading-relaxed text-muted-foreground">
											Secure your account with Google Authenticator, 1Password, Apple Passwords,
											Authy, or any standard TOTP app.
										</p>
									</div>
								</div>

								<Button onClick={startSetup} disabled={settingUp}>
									{settingUp ? <Spinner /> : <QrCode />}
									<span>Set up authenticator</span>
								</Button>
							</div>
						) : (
							<div className="space-y-6">
								{/* Step 1: Scan QR Code */}
								<div className="space-y-3">
									<div className="flex items-center gap-2">
										<span className="flex size-5 items-center justify-center rounded-full bg-primary-muted text-xs font-semibold text-primary-muted-foreground">
											1
										</span>
										<h2 className="text-sm font-semibold text-foreground">Scan the QR code</h2>
									</div>
									<p className="text-xs text-muted-foreground">
										Open your authenticator app (Google Authenticator, 1Password, Apple Passwords,
										Authy) and scan the QR code below.
									</p>

									{/* QR Code Container */}
									<div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/30 p-6">
										{qrDataUrl ? (
											<div className="rounded-xl border border-border bg-white p-3 shadow-sm">
												<img
													src={qrDataUrl}
													alt="Authenticator setup QR code"
													className="size-48 rounded"
													width={192}
													height={192}
												/>
											</div>
										) : (
											<div className="flex size-48 items-center justify-center">
												<Spinner className="size-6 text-muted-foreground" />
											</div>
										)}

										{/* Secret Key Toggle / Copy */}
										<div className="mt-4 w-full max-w-sm text-center">
											<Button
												type="button"
												variant="link"
												size="xs"
												className="text-muted-foreground hover:text-foreground"
												onClick={() => setShowManualKey((v) => !v)}
											>
												{showManualKey
													? "Hide manual setup key"
													: "Can't scan? Enter key manually"}
											</Button>

											{showManualKey && (
												<div className="mt-3 space-y-2 rounded-lg border border-border bg-background p-3 text-left">
													<div className="flex items-center justify-between">
														<span className="text-2xs font-medium tracking-wider text-muted-foreground uppercase">
															Secret key
														</span>
														<Button
															type="button"
															variant="ghost"
															size="xs"
															className="text-muted-foreground hover:text-foreground"
															onClick={() => copyToClipboard(secret, "secret")}
														>
															{copiedSecret ? (
																<Check className="text-success" />
															) : (
																<Copy />
															)}
															<span>{copiedSecret ? "Copied" : "Copy"}</span>
														</Button>
													</div>
													<p className="font-mono text-xs font-semibold tracking-wider break-all text-foreground select-all">
														{formattedSecret}
													</p>
												</div>
											)}
										</div>
									</div>
								</div>

								{/* Step 2: Verification Code Form */}
								<form onSubmit={handleEnable} className="space-y-4 border-t border-border pt-4">
									<div className="flex items-center gap-2">
										<span className="flex size-5 items-center justify-center rounded-full bg-primary-muted text-xs font-semibold text-primary-muted-foreground">
											2
										</span>
										<h2 className="text-sm font-semibold text-foreground">Verify the code</h2>
									</div>
									<p className="text-xs text-muted-foreground">
										Enter the 6-digit confirmation code shown in your authenticator app.
									</p>

									<div className="flex max-w-xs items-center gap-2.5">
										<Input
											value={code}
											onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
											placeholder="123456"
											maxLength={6}
											inputMode="numeric"
											autoComplete="one-time-code"
											aria-label="6-digit confirmation code"
											autoFocus
											className="h-10 text-center font-mono text-base font-medium tracking-widest"
											required
										/>
										<Button
											type="submit"
											size="lg"
											className="shrink-0"
											disabled={confirming || code.trim().length !== 6}
										>
											{confirming ? <Spinner /> : "Confirm & Activate"}
										</Button>
									</div>
								</form>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* Error Alert */}
			<FormError>{error}</FormError>
		</PageShell>
	);
}
