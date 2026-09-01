import { createFileRoute } from "@tanstack/react-router";
import Layout from "../components/Layout";
import Playground from "../pages/Playground";

export const Route = createFileRoute("/playground")({
	component: () => (
		<Layout>
			<Playground />
		</Layout>
	),
});
