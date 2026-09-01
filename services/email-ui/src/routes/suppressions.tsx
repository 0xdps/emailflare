import { createFileRoute } from "@tanstack/react-router";
import Layout from "../components/Layout";
import SuppressionsPage from "../pages/Suppressions";

export const Route = createFileRoute("/suppressions")({
	component: () => (
		<Layout>
			<SuppressionsPage />
		</Layout>
	),
});
