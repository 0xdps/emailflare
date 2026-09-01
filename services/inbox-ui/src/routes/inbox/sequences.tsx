import { createFileRoute } from "@tanstack/react-router";
import Layout from "../../components/Layout";
import Sequences from "../../pages/inbox/Sequences";

export const Route = createFileRoute("/inbox/sequences")({
	component: () => (
		<Layout>
			<Sequences />
		</Layout>
	),
});
