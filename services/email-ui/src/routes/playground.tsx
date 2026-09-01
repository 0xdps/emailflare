import { createFileRoute } from "@tanstack/react-router";
import Layout from "../components/Layout";
import PlaygroundPage from "../pages/Playground";

export const Route = createFileRoute("/playground")({
	component: () => (
		<Layout>
			<PlaygroundPage />
		</Layout>
	),
});
