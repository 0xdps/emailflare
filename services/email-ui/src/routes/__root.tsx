import { createRootRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import api from "../api";

export const Route = createRootRoute({
	component: () => {
		const navigate = useNavigate();
		const [checked, setChecked] = useState(false);

		useEffect(() => {
			if (window.location.pathname.startsWith("/login")) {
				setChecked(true);
				return;
			}
			api.get("/api/auth/me")
				.then(() => setChecked(true))
				.catch(() => navigate({ to: "/login" }));
		}, []);

		if (!checked) return null; // wait for session check before rendering
		return <Outlet />;
	},
});
