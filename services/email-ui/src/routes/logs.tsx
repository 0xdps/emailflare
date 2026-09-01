import { createFileRoute } from "@tanstack/react-router";
import Layout from "../components/Layout";
import LogsPage from "../pages/Logs";

export const Route = createFileRoute("/logs")({
	component: () => (
		<Layout>
			<LogsPage />
		</Layout>
	),
});
