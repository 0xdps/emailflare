import Layout from "@/components/Layout";
import Page from "@/components/pages/Lists";
import { getListsList } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function RoutePage() {
	const initialLists = await getListsList().catch(() => []);

	return (
		<Layout>
			<Page initialLists={initialLists as any} />
		</Layout>
	);
}
