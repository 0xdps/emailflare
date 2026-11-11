"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SecurityPage() {
	const [enabled, setEnabled] = useState(false);
	const [uri, setUri] = useState("");
	const [secret, setSecret] = useState("");
	const [code, setCode] = useState("");
	const [backupCodes, setBackupCodes] = useState<string[]>([]);
	const [error, setError] = useState("");

	useEffect(() => {
		api.get<{ enabled: boolean }>("/api/auth/totp/status")
			.then((res) => setEnabled(res.data.enabled))
			.catch(() => setEnabled(false));
	}, []);

	return (
		<div className="mx-auto max-w-lg space-y-4 p-6 md:p-8">
			<div>
				<p className="text-xs uppercase tracking-wider text-muted-foreground">Account</p>
				<h1 className="text-2xl font-semibold">Two-factor authentication</h1>
				<p className="mt-1 text-xs text-muted-foreground">
					Use an authenticator app. Backup codes work once if you lose the device.
				</p>
			</div>
			{enabled ? (
				<form
					className="space-y-3 rounded-xl border p-4"
					onSubmit={async (e) => {
						e.preventDefault();
						setError("");
						try {
							await api.post("/api/auth/totp/disable", { code });
							setEnabled(false);
							setCode("");
						} catch {
							setError("That code did not match.");
						}
					}}
				>
					<p className="text-sm">Authenticator is on.</p>
					<Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Current code" required />
					<Button type="submit" variant="outline" size="sm">
						Turn off
					</Button>
				</form>
			) : (
				<div className="space-y-3 rounded-xl border p-4">
					<Button
						size="sm"
						onClick={async () => {
							const { data } = await api.post<{ secret: string; uri: string }>("/api/auth/totp/setup");
							setSecret(data.secret);
							setUri(data.uri);
						}}
					>
						Set up authenticator
					</Button>
					{secret && (
						<form
							className="space-y-2"
							onSubmit={async (e) => {
								e.preventDefault();
								setError("");
								try {
									const { data } = await api.post<{ backupCodes: string[] }>(
										"/api/auth/totp/enable",
										{ code },
									);
									setBackupCodes(data.backupCodes);
									setEnabled(true);
								} catch {
									setError("That code did not match.");
								}
							}}
						>
							<p className="break-all font-mono text-xs">{secret}</p>
							<p className="break-all text-[11px] text-muted-foreground">{uri}</p>
							<Input
								value={code}
								onChange={(e) => setCode(e.target.value)}
								placeholder="6-digit code"
								required
							/>
							<Button type="submit" size="sm">
								Confirm
							</Button>
						</form>
					)}
				</div>
			)}
			{backupCodes.length > 0 && (
				<pre className="rounded-xl border bg-muted/30 p-3 text-xs">{backupCodes.join("\n")}</pre>
			)}
			{error && <p className="text-xs text-destructive">{error}</p>}
		</div>
	);
}
