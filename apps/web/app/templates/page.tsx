import Layout from "@/components/Layout";
import TemplatesPage from "@/components/pages/Templates";
import { getTemplatesList } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function RoutePage() {
	const initialTemplates = await getTemplatesList();

	return (
		<Layout>
			<TemplatesPage initialTemplates={initialTemplates as any} />
		</Layout>
	);
}
