import { redirect } from "next/navigation";
import Layout from "@/components/Layout";
import SecurityPage from "@/components/pages/settings/Security";
import { getServerSession } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function Page() {
	const session = await getServerSession().catch(() => null);
	if (!session) redirect("/login");
	return (
		<Layout>
			<SecurityPage />
		</Layout>
	);
}
