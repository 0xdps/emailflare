import { createFileRoute } from "@tanstack/react-router";
import Layout from "../components/Layout";
import TemplatesPage from "../pages/Templates";

export const Route = createFileRoute("/templates")({
	component: () => (
		<Layout>
			<TemplatesPage />
		</Layout>
	),
});
