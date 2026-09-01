import { createFileRoute } from "@tanstack/react-router";
import Layout from "../components/Layout";
import Keys from "../pages/Keys";

export const Route = createFileRoute("/keys")({
	component: () => (
		<Layout>
			<Keys />
		</Layout>
	),
});
