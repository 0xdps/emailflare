import { AsyncLocalStorage } from "node:async_hooks";
import { THEMES, themeToTailwindConfig } from "./themes.js";

const DEFAULT_CONFIG = themeToTailwindConfig(THEMES["default"]);

const storage = new AsyncLocalStorage<object>();

/**
 * Run `fn` with the given Tailwind config set as the active email theme.
 * All layout components rendered within `fn` will pick up the theme automatically.
 */
export function runWithTheme(config: object, fn: () => Promise<string>): Promise<string> {
	return storage.run(config, fn);
}

/**
 * Returns the Tailwind config for the currently active theme.
 * Falls back to the default (orange) theme when called outside a runWithTheme context.
 */
export function getThemeConfig(): object {
	return storage.getStore() ?? DEFAULT_CONFIG;
}
