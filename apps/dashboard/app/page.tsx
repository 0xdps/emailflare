import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function RootPage() {
	const session = await getServerSession().catch(() => null);
	if (!session) {
		redirect("/login");
	}

	const hasInbox = session.userType === "admin" || session.accessTypes.includes("inbox");
	if (hasInbox) {
		redirect("/inbox");
	}

	const hasApi = session.accessTypes.includes("api");
	if (hasApi) {
		redirect("/developer/overview");
	}

	const hasTester = session.accessTypes.includes("tester");
	if (hasTester) {
		redirect("/test-emails");
	}

	redirect("/login");
}
