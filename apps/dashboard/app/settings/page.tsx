import { redirect } from "next/navigation";
import Layout from "@/components/Layout";
import AdminHome from "@/components/pages/settings/AdminHome";
import { getDomainsList, getInboxesList, getServerSession, getUsersList, getApiKeysList } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function SettingsHome() {
	const session = await getServerSession().catch(() => null);
	if (!session) redirect("/login");
	if (session.userType !== "admin") redirect("/inbox");

	const [domains, mailboxes, users, keys] = await Promise.all([
		getDomainsList(),
		getInboxesList(),
		getUsersList(),
		getApiKeysList(),
	]);

	return (
		<Layout>
			<AdminHome
				domains={domains.length}
				readyDomains={domains.filter((domain) => domain.verified).length}
				mailboxes={mailboxes.length}
				users={users.length}
				keys={keys.filter((key) => key.active).length}
			/>
		</Layout>
	);
}
