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
		<div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-[12.5px] shrink-0">
			<ShieldCheck size={13} className="shrink-0 text-amber-600" />
			<span>
				<span className="font-semibold">Viewing as administrator</span>
				{" · "}You have global access to all mailboxes and settings.
			</span>
		</div>
	);
}
