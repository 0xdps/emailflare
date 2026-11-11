import { redirect } from "next/navigation";
import { getServerSession, getDomainCatalog } from "@/lib/server/queries";
import { getReadiness } from "@/app/actions/setup";
import Readiness from "@/components/pages/Readiness";

export const dynamic = "force-dynamic";

export default async function ReadyPage() {
	const session = await getServerSession().catch(() => null);
	if (!session) redirect("/login");
	if (session.userType !== "admin") redirect("/inbox");

	const [readiness, catalog] = await Promise.all([
		getReadiness().catch(() => null),
		getDomainCatalog().catch(() => ({ zones: [], truncated: false, error: "Could not load zones." })),
	]);

	return (
		<Readiness
			initialReadiness={readiness}
			initialCatalog={catalog.zones}
			catalogError={catalog.error}
			adminUser={{ name: session.name, email: session.email }}
		/>
	);
}
