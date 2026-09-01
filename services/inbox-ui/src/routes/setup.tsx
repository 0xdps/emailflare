import { createFileRoute } from "@tanstack/react-router";
import Setup from "../pages/Setup";

export const Route = createFileRoute("/setup")({
	component: Setup,
});
