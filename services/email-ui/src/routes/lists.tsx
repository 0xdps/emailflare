import { createFileRoute } from "@tanstack/react-router";
import Layout from "../components/Layout";
import ListsPage from "../pages/Lists";

export const Route = createFileRoute("/lists")({
	component: () => (
		<Layout>
			<ListsPage />
		</Layout>
	),
});
