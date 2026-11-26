export function senderName(name: string | null | undefined, email: string): string {
	return name?.trim() || email;
}

export function initialsOf(name: string | null | undefined, email: string): string {
	const label = name?.trim();
	if (label) {
		const parts = label.split(/\s+/);
		return (parts.length >= 2 ? parts[0][0] + parts[1][0] : label.slice(0, 2)).toUpperCase();
	}
	return (email || "?")[0].toUpperCase();
}

// Stable per-sender tint built from chart tokens so avatars follow the theme.
const TONES = [
	"bg-chart-1/15 text-chart-1",
	"bg-chart-2/15 text-chart-2",
	"bg-chart-3/15 text-chart-3",
	"bg-chart-4/20 text-warning-muted-foreground",
	"bg-chart-5/15 text-chart-5",
];

export function avatarTone(seed: string): string {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
	return TONES[hash % TONES.length];
}

export function relativeTime(dateStr?: string | null): string {
	if (!dateStr) return "";
	const date = new Date(dateStr);
	const mins = Math.floor((Date.now() - date.getTime()) / 60000);
	if (mins < 1) return "now";
	if (mins < 60) return `${mins}m`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h`;
	const days = Math.floor(hrs / 24);
	if (days < 7) return `${days}d`;
	return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export type DateBucket = "Today" | "Yesterday" | "This week" | "Earlier";

export function dateBucket(dateStr: string, now = new Date()): DateBucket {
	const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	const days = Math.round((startOfDay(now) - startOfDay(new Date(dateStr))) / 86_400_000);
	if (days <= 0) return "Today";
	if (days === 1) return "Yesterday";
	if (days < 7) return "This week";
	return "Earlier";
}

/** One-line preview: drops quoted history and collapses whitespace. */
export function previewText(body: string | null | undefined, max = 140): string {
	if (!body) return "";
	const lines = body.split("\n");
	const cut = lines.findIndex((line) => /^>\s?/.test(line) || /^On\s.+wrote:\s*$/.test(line));
	const text = (cut > 0 ? lines.slice(0, cut) : lines).join(" ").replace(/\s+/g, " ").trim();
	return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	zwnj: "",
	hellip: "…",
	ndash: "–",
	mdash: "—",
};

/** Best-effort plain text from an HTML body, for previews and the Plain view of HTML-only mail. */
export function htmlToText(html: string | null | undefined): string {
	if (!html) return "";
	return html
		.replace(/<(head|style|script|title)\b[\s\S]*?<\/\1>/gi, "")
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/<(br|\/p|\/div|\/tr|\/li|\/h[1-6]|\/table)\b[^>]*>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
			if (entity[0] === "#") {
				const code =
					entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
				return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
			}
			return ENTITIES[entity.toLowerCase()] ?? match;
		})
		.replace(/[ \t\u00a0]+/g, " ")
		.replace(/ ?\n ?/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/** Escaped HTML for a plain-text body with links made clickable. Whitespace is preserved by the caller's CSS. */
export function textToHtml(text: string): string {
	const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	return escaped.replace(/\bhttps?:\/\/[^\s<]+/g, (url) => {
		const trailing = url.match(/[.,;:!?)\]]+$/)?.[0] ?? "";
		const href = trailing ? url.slice(0, -trailing.length) : url;
		return `<a href="${href.replace(/"/g, "&quot;")}" rel="noopener noreferrer">${href}</a>${trailing}`;
	});
}

/** Splits a plain-text reply into the new message and the quoted history below it. */
export function stripQuotedReply(body: string | null | undefined): { content: string; quote: string | null } {
	if (!body) return { content: "", quote: null };

	const match = body.match(/^On\s.+?wrote:\s*$/m);
	if (match && match.index !== undefined && match.index > 0) {
		return { content: body.slice(0, match.index).trim(), quote: body.slice(match.index).trim() };
	}

	const lines = body.split("\n");
	const firstQuote = lines.findIndex((l) => /^>\s/.test(l));
	if (firstQuote > 0) {
		return {
			content: lines.slice(0, firstQuote).join("\n").trim(),
			quote: lines.slice(firstQuote).join("\n").trim(),
		};
	}
	return { content: body.trim(), quote: null };
}

/** One-line preview that falls back to the HTML body when a message has no plain-text part. */
export function messagePreview(message: { body_text?: string | null; body_html?: string | null }, max = 140): string {
	return previewText(message.body_text?.trim() ? message.body_text : htmlToText(message.body_html), max);
}
