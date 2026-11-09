import { redirect } from "next/navigation";
import Layout from "@/components/Layout";
import DomainsPage from "@/components/pages/Domains";
import { getDomainCatalog, getDomainsList, getServerSession } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function RoutePage() {
	const session = await getServerSession().catch(() => null);
	if (!session) {
		redirect("/login");
	}

	if (session.userType !== "admin") {
		redirect("/inbox");
	}

	const [initialDomains, catalog] = await Promise.all([getDomainsList(), getDomainCatalog()]);

	return (
		<Layout>
			<DomainsPage
				initialDomains={initialDomains as any}
				initialCatalog={catalog.zones}
				catalogError={catalog.error}
			/>
		</Layout>
	);
}
