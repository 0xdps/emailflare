import { redirect } from "next/navigation";
import Layout from "@/components/Layout";
import Page from "@/components/pages/inbox/Sequences";
import { getSequencesList, getServerSession } from "@/lib/server/queries";

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

	const initialSequences = await getSequencesList().catch(() => []);

	return (
		<Layout>
			<Page initialSequences={initialSequences as any} />
		</Layout>
	);
}
