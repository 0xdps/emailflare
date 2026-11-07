import { redirect } from "next/navigation";
import Layout from "@/components/Layout";
import Dashboard from "@/components/pages/Dashboard";
import { getDashboardStats, getDashboardLogs, getCloudflareStatus, getServerSession } from "@/lib/server/queries";

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

	const [stats, logs, cfStatus] = await Promise.all([
		getDashboardStats("7d"),
		getDashboardLogs(10),
		getCloudflareStatus(),
	]);

	return (
		<Layout>
			<Dashboard initialStats={stats} initialLogs={logs} initialCfStatus={cfStatus} />
		</Layout>
	);
}
