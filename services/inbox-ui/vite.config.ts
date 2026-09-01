import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
	plugins: [TanStackRouterVite({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		host: "0.0.0.0",
		port: 5174,
		proxy: {
			"/api": `http://localhost:${process.env.VITE_BACKEND_PORT ?? "8787"}`,
			"/v1": `http://localhost:${process.env.VITE_BACKEND_PORT ?? "8787"}`,
		},
	},
});
