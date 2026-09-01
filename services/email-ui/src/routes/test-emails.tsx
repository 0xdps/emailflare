import { createFileRoute } from "@tanstack/react-router";
import Layout from "../components/Layout";
import TestMailboxPage from "../pages/TestMailbox";

export const Route = createFileRoute("/test-emails")({
	component: () => (
		<Layout>
			<TestMailboxPage />
		</Layout>
	),
});
