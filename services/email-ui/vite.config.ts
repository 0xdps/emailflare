import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Docker dev uses the compose service name. Override to point this UI at
// wrangler (`http://127.0.0.1:8787`) or the deployed Worker (https://….workers.dev).
const apiProxy = process.env.API_PROXY ?? "http://backend:3000";

export default defineConfig({
	plugins: [TanStackRouterVite({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		host: "0.0.0.0",
		port: 5173,
		proxy: {
			"/api": { target: apiProxy, changeOrigin: true },
			"/v1": { target: apiProxy, changeOrigin: true },
			"/auth": { target: apiProxy, changeOrigin: true },
		},
	},
});
