import { redirect } from "next/navigation";
import Layout from "@/components/Layout";
import InboxSettings from "@/components/pages/inbox/InboxSettings";
import { getInboxesList, getDomainsList, getServerSession } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function RoutePage() {
	const session = await getServerSession().catch(() => null);
	if (!session) {
		redirect("/login");
	}

	if (session.userType !== "admin") {
		redirect("/inbox");
	}

	const [inboxes, domains] = await Promise.all([getInboxesList(), getDomainsList()]);

	return (
		<Layout>
			<InboxSettings initialInboxes={inboxes as any} initialDomains={domains as any} />
		</Layout>
	);
}
