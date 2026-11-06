import Layout from "@/components/Layout";
import DomainsPage from "@/components/pages/Domains";
import { getDomainsList } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function RoutePage() {
	const initialDomains = await getDomainsList();

	return (
		<Layout>
			<DomainsPage initialDomains={initialDomains as any} />
		</Layout>
	);
}
