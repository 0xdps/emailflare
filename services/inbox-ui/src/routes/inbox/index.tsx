import { createFileRoute } from "@tanstack/react-router";
import Layout from "../../components/Layout";
import People from "../../pages/inbox/People";

export const Route = createFileRoute("/inbox/")({
	component: () => (
		<Layout>
			<People />
		</Layout>
	),
});
