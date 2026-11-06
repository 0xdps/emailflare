import Layout from "@/components/Layout";
import InboxSettings from "@/components/pages/inbox/InboxSettings";
import { getInboxesList, getDomainsList } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function RoutePage() {
	const [inboxes, domains] = await Promise.all([getInboxesList(), getDomainsList()]);

	return (
		<Layout>
			<InboxSettings initialInboxes={inboxes as any} initialDomains={domains as any} />
		</Layout>
	);
}
