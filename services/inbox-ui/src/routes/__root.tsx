import { createRootRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSetupStatus, me } from "../api";
import { UserProvider } from "../UserContext";

function AuthGate({ children }: { children: React.ReactNode }) {
	const navigate = useNavigate();
	const [checked, setChecked] = useState(false);

	useEffect(() => {
		const path = window.location.pathname;
		// These routes don't need auth
		if (path.startsWith("/setup") || path.startsWith("/login") || path.startsWith("/invite")) {
			setChecked(true);
			return;
		}

		// Parallel: check setup status AND session in one round-trip window
		Promise.all([getSetupStatus().catch(() => ({ initialized: false })), me().catch(() => null)]).then(
			([status, user]) => {
				if (!status.initialized) {
					navigate({ to: "/setup" });
					return;
				}
				if (!user) {
					navigate({ to: "/login" });
					return;
				}
				setChecked(true);
			},
		);
	}, []);

	if (!checked) {
		// Skeleton while checking auth — avoids blank page flash
		return (
			<div className="flex h-screen bg-background items-center justify-center">
				<div className="flex flex-col items-center gap-3">
					<div className="size-8 rounded-full bg-orange-100 animate-pulse" />
					<div className="h-3 w-24 bg-zinc-100 rounded animate-pulse" />
				</div>
			</div>
		);
	}

	return <>{children}</>;
}

export const Route = createRootRoute({
	component: () => (
		<AuthGate>
			<UserProvider>
				<Outlet />
			</UserProvider>
		</AuthGate>
	),
});
