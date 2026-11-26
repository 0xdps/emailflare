import { notFound, redirect } from "next/navigation";
import Layout from "@/components/Layout";
import DomainDetail from "@/components/pages/DomainDetail";
import { getDomainDetail, getServerSession } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function RoutePage({ params }: { params: Promise<{ id: string }> }) {
	const session = await getServerSession().catch(() => null);
	if (!session) redirect("/login");
	if (session.userType !== "admin") redirect("/inbox");

	const { id } = await params;
	const detail = await getDomainDetail(id);
	if (!detail) notFound();

	return (
		<Layout>
			<DomainDetail detail={detail} adminEmail={session.email} />
		</Layout>
	);
}
