import { createFileRoute } from "@tanstack/react-router";
import Layout from "../components/Layout";
import DomainsPage from "../pages/Domains";

export const Route = createFileRoute("/domains")({
	component: () => (
		<Layout>
			<DomainsPage />
		</Layout>
	),
});
