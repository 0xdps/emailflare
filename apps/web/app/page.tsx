import Layout from "@/components/Layout";
import Dashboard from "@/components/pages/Dashboard";
import { getDashboardStats, getDashboardLogs, getCloudflareStatus } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function RoutePage() {
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
