import Layout from "@/components/Layout";
import UsersPage from "@/components/pages/settings/Users";
import { getUsersList } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function RoutePage() {
	const initialUsers = await getUsersList();

	return (
		<Layout>
			<UsersPage initialUsers={initialUsers as any} />
		</Layout>
	);
}
