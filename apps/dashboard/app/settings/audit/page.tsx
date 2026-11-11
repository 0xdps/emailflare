import { redirect } from "next/navigation";
import Layout from "@/components/Layout";
import AuditLogPage from "@/components/pages/AuditLog";
import { getServerSession } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function Page() {
	const session = await getServerSession().catch(() => null);
	if (!session) redirect("/login");
	if (session.userType !== "admin") redirect("/inbox");
	return (
		<Layout>
			<AuditLogPage />
		</Layout>
	);
}
