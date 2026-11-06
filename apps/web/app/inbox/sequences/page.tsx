import Layout from "@/components/Layout";
import Page from "@/components/pages/inbox/Sequences";
import { getSequencesList } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function RoutePage() {
	const initialSequences = await getSequencesList().catch(() => []);

	return (
		<Layout>
			<Page initialSequences={initialSequences as any} />
		</Layout>
	);
}
