import React from "react";
import { ShieldCheck } from "lucide-react";
import { useUser } from "../UserContext";

/**
 * Shown at the top of inbox pages when the logged-in user is a super-admin.
 * Makes cross-inbox access visible — no silent owner access.
 */
export default function OwnerAccessBanner() {
	const { user } = useUser();
	const show = user?.role === "super-admin";

	if (!show) return null;

	return (
		<div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-[12.5px] shrink-0">
			<ShieldCheck size={13} className="shrink-0 text-amber-600" />
			<span>
				<span className="font-semibold">Viewing as owner</span>
				{" · "}You have full access to all inboxes.
			</span>
		</div>
	);
}
