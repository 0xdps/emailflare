import { createFileRoute } from "@tanstack/react-router";
import Layout from "../components/Layout";
import KeysPage from "../pages/Keys";

export const Route = createFileRoute("/keys")({
	component: () => (
		<Layout>
			<KeysPage />
		</Layout>
	),
});
