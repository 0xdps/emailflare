import { redirect } from "next/navigation";
import Layout from "@/components/Layout";
import PeoplePage from "@/components/pages/inbox/People";
import { getInboxesList, getPeopleList, getServerSession } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function RoutePage() {
	const session = await getServerSession().catch(() => null);
	if (!session) {
		redirect("/login");
	}

	const hasInbox = session.userType === "admin" || session.accessTypes.includes("inbox");
	if (!hasInbox) {
		const hasApi = session.accessTypes.includes("api");
		redirect(hasApi ? "/developer/overview" : "/login");
	}

	const [initialPeople, initialInboxes] = await Promise.all([
		getPeopleList().catch(() => []),
		getInboxesList().catch(() => []),
	]);

	return (
		<Layout>
			<PeoplePage initialPeople={initialPeople as any} initialInboxes={initialInboxes as any} />
		</Layout>
	);
}
