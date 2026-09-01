import { createFileRoute } from "@tanstack/react-router";
import Layout from "../../components/Layout";
import InboxSettings from "../../pages/inbox/InboxSettings";

export const Route = createFileRoute("/inbox/settings")({
	component: () => (
		<Layout>
			<InboxSettings />
		</Layout>
	),
});
