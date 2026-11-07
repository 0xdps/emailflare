import { redirect } from "next/navigation";
import Layout from "@/components/Layout";
import InboxClient from "@/components/modules/inbox/InboxClient";
import { getInboxesList, getThreadsList, getServerSession } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function RoutePage() {
	const session = await getServerSession().catch(() => null);
	if (!session) {
		redirect("/login");
	}

	const hasInbox = session.userType === "admin" || session.accessTypes.includes("inbox");
	if (!hasInbox) {
		const hasApi = session.accessTypes.includes("api");
		redirect(hasApi ? "/developer/overview" : "/login");
	}

	const [initialThreads, initialInboxes] = await Promise.all([
		getThreadsList().catch(() => []),
		getInboxesList().catch(() => []),
	]);

	return (
		<Layout>
			<InboxClient initialThreads={initialThreads as any} initialInboxes={initialInboxes as any} />
		</Layout>
	);
}
