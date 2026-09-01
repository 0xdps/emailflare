import { createFileRoute } from "@tanstack/react-router";
import Layout from "../components/Layout";
import Templates from "../pages/Templates";

export const Route = createFileRoute("/templates")({
	component: () => (
		<Layout>
			<Templates />
		</Layout>
	),
});
