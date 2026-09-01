import { defineConfig } from "astro/config";
import icon from "astro-icon";

export default defineConfig({
	output: "static",
	prefetch: true,
	integrations: [icon()],
});
