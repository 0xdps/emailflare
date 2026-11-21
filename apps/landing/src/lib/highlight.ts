import { codeToHtml } from "shiki";

export type Lang = "bash" | "json" | "ts" | "js" | "python" | "go" | "html" | "handlebars" | "toml" | "http" | "text";

/** Highlight at build time. Output sits on the always-dark `ink` surface. */
export async function highlight(code: string, lang: Lang = "bash"): Promise<string> {
	return codeToHtml(code.replace(/^\n+|\s+$/g, ""), { lang, theme: "tokyo-night" });
}
