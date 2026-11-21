import { defineConfig } from "astro/config";
import icon from "astro-icon";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	site: "https://emailflare.dev",
	output: "static",
	prefetch: { prefetchAll: false, defaultStrategy: "hover" },
	markdown: { shikiConfig: { theme: "tokyo-night" } },
	integrations: [icon(), react(), sitemap()],
	vite: {
		plugins: [tailwindcss()],
		optimizeDeps: {
			include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
		},
	},
});
