import { createFileRoute } from "@tanstack/react-router";
import Layout from "../components/Layout";
import Domains from "../pages/Domains";

export const Route = createFileRoute("/domains")({
	component: () => (
		<Layout>
			<Domains />
		</Layout>
	),
});
