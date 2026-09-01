import { createFileRoute } from "@tanstack/react-router";
import Layout from "../../components/Layout";
import Users from "../../pages/settings/Users";

export const Route = createFileRoute("/settings/users")({
	component: () => (
		<Layout>
			<Users />
		</Layout>
	),
});
