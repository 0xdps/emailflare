import { createFileRoute } from "@tanstack/react-router";
import Layout from "../components/Layout";
import Logs from "../pages/Logs";

export const Route = createFileRoute("/logs")({
	component: () => (
		<Layout>
			<Logs />
		</Layout>
	),
});
