import { redirect } from "next/navigation";
import Layout from "@/components/Layout";
import Page from "@/components/pages/Suppressions";
import { getSuppressionsList, getServerSession } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function RoutePage() {
	const session = await getServerSession().catch(() => null);
	if (!session) {
		redirect("/login");
	}

	const hasApi = session.userType === "admin" || session.accessTypes.includes("api");
	if (!hasApi) {
		redirect("/inbox");
	}

	const initialResult = await getSuppressionsList(1, 50).catch(() => ({
		data: [],
		total: 0,
		page: 1,
		limit: 50,
		pages: 0,
	}));

	return (
		<Layout>
			<Page initialResult={initialResult as any} />
		</Layout>
	);
}
