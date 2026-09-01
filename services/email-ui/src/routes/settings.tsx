import { createFileRoute } from "@tanstack/react-router";
import Layout from "../components/Layout";
import SettingsPage from "../pages/Settings";

export const Route = createFileRoute("/settings")({
	component: () => (
		<Layout>
			<SettingsPage />
		</Layout>
	),
});
