// Re-export email rendering utilities from the shared @emailflare/emails package.
// Wrangler (esbuild) bundles these at deploy time.
// Requires the `nodejs_compat` compatibility flag for AsyncLocalStorage + React SSR.

export { renderLayout, LAYOUTS, THEMES, themeToTailwindConfig } from "@emailflare/emails";

export type { LayoutName } from "@emailflare/emails";
