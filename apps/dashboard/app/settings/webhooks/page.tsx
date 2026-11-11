import { redirect } from "next/navigation";
import Layout from "@/components/Layout";
import WebhooksPage from "@/components/pages/Webhooks";
import { getServerSession } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function Page() {
	const session = await getServerSession().catch(() => null);
	if (!session) redirect("/login");
	if (session.userType !== "admin") redirect("/inbox");
	return (
		<Layout>
			<WebhooksPage />
		</Layout>
	);
}
