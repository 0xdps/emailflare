import Layout from "@/components/Layout";
import Page from "@/components/pages/inbox/People";
import { getInboxesList, getPeopleList } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function RoutePage() {
	const [initialPeople, initialInboxes] = await Promise.all([
		getPeopleList().catch(() => []),
		getInboxesList().catch(() => []),
	]);

	return (
		<Layout>
			<Page initialPeople={initialPeople as any} initialInboxes={initialInboxes as any} />
		</Layout>
	);
}
