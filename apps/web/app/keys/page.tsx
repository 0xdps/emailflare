import Layout from "@/components/Layout";
import KeysPage from "@/components/pages/Keys";
import { getApiKeysList } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function RoutePage() {
	const initialKeys = await getApiKeysList();

	return (
		<Layout>
			<KeysPage initialKeys={initialKeys as any} />
		</Layout>
	);
}
