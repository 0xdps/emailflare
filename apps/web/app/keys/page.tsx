import { redirect } from "next/navigation";
import Layout from "@/components/Layout";
import KeysPage from "@/components/pages/Keys";
import { getApiKeysList, getServerSession } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function RoutePage() {
	const session = await getServerSession().catch(() => null);
	if (!session) {
		redirect("/login");
	}

	if (session.userType !== "admin") {
		redirect("/inbox");
	}

	const initialKeys = await getApiKeysList();

	return (
		<Layout>
			<KeysPage initialKeys={initialKeys as any} />
		</Layout>
	);
}
