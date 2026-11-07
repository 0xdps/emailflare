import { redirect } from "next/navigation";
import Layout from "@/components/Layout";
import DomainsPage from "@/components/pages/Domains";
import { getDomainsList, getServerSession } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function RoutePage() {
	const session = await getServerSession().catch(() => null);
	if (!session) {
		redirect("/login");
	}

	if (session.userType !== "admin") {
		redirect("/inbox");
	}

	const initialDomains = await getDomainsList();

	return (
		<Layout>
			<DomainsPage initialDomains={initialDomains as any} />
		</Layout>
	);
}
