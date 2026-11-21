const escapeHtml = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const codeClass = "bg-muted text-foreground rounded-md border px-1.5 py-0.5 font-mono text-[0.8125rem] break-words";
const linkClass =
	"text-primary-muted-foreground decoration-primary/40 hover:decoration-primary font-medium underline underline-offset-4";

/**
 * Renders the small inline subset used in page data: `code`, **bold** and [text](url).
 * Input is author-controlled copy, and everything is escaped first.
 */
export function inlineMd(src: string): string {
	return escapeHtml(src)
		.replace(/`([^`]+)`/g, (_, c) => `<code class="${codeClass}">${c}</code>`)
		.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
		.replace(
			/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
			`<a href="$2" class="${linkClass}" target="_blank" rel="noopener">$1</a>`,
		)
		.replace(/\[([^\]]+)\]\(([/#][^)\s]*)\)/g, `<a href="$2" class="${linkClass}">$1</a>`);
}
