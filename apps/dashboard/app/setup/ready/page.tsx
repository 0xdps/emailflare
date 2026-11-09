import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server/queries";
import Readiness from "@/components/pages/Readiness";

export const dynamic = "force-dynamic";

export default async function ReadyPage() {
	const session = await getServerSession().catch(() => null);
	if (!session) redirect("/login");
	if (session.userType !== "admin") redirect("/settings");
	return <Readiness />;
}
