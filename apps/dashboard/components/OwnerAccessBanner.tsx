import React from "react";
import { ShieldCheck } from "lucide-react";
import { usePermissions } from "@/lib/UserContext";

/**
 * Shown at the top of inbox pages when the logged-in user is an admin.
 * Makes cross-inbox access visible — no silent owner access.
 */
export default function OwnerAccessBanner() {
	const { isAdmin } = usePermissions();

	if (!isAdmin) return null;

	return (
		<div className="flex shrink-0 items-center gap-2 border-b bg-warning-muted px-4 py-1.5 text-xs text-warning-muted-foreground">
			<ShieldCheck className="size-3.5 shrink-0" />
			<span>
				<span className="font-semibold">Viewing as administrator</span>
				{" · "}You have access to every mailbox.
			</span>
		</div>
	);
}
