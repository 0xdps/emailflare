import { createFileRoute } from "@tanstack/react-router";
import Layout from "../components/Layout";
import Dashboard from "../pages/Dashboard";

export const Route = createFileRoute("/")({
	component: () => (
		<Layout>
			<Dashboard />
		</Layout>
	),
});
