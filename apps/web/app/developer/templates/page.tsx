import { redirect } from "next/navigation";
import Layout from "@/components/Layout";
import TemplatesPage from "@/components/pages/Templates";
import { getTemplatesList, getServerSession } from "@/lib/server/queries";

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

	const initialTemplates = await getTemplatesList();

	return (
		<Layout>
			<TemplatesPage initialTemplates={initialTemplates as any} />
		</Layout>
	);
}
