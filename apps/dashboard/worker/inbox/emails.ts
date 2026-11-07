// Re-export email rendering utilities from the local emails module.
// Wrangler (esbuild) bundles these at deploy time.
// Requires the `nodejs_compat` compatibility flag for AsyncLocalStorage + React SSR.

export { renderLayout, LAYOUTS, THEMES, themeToTailwindConfig } from "../../emails/index.ts";

export type { LayoutName } from "../../emails/index.ts";
