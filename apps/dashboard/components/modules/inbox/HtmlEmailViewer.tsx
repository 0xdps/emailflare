"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ImageIcon, ShieldAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { htmlToText, stripQuotedReply, textToHtml } from "@/lib/inbox/format";
import { cn } from "@/lib/utils";

interface HtmlEmailViewerProps {
	html: string | null;
	text: string | null;
	className?: string;
}

type ViewMode = "html" | "text" | "source";

function hasRemoteResources(html: string): boolean {
	return (
		/<img[^>]+src=["'](https?:|\/\/)/i.test(html) ||
		/url\(\s*["']?(https?:|\/\/)/i.test(html) ||
		/<source[^>]+srcset=["'](https?:|\/\/)/i.test(html)
	);
}

function stripRemoteResources(html: string): string {
	const placeholder =
		"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='18' height='18' x='3' y='3' rx='2' ry='2'/%3E%3Ccircle cx='9' cy='9' r='2'/%3E%3Cpath d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/%3E%3C/svg%3E";

	return html
		.replace(/(<img\b[^>]*?)\bsrc=(["'])(https?:|\/\/)(.*?)\2/gi, `$1data-src=$2$3$4$2 src="${placeholder}"`)
		.replace(/(<img\b[^>]*?)\bsrcset=(["'])(.*?)\2/gi, `$1data-srcset=$2$3$2`)
		.replace(/(<source\b[^>]*?)\bsrcset=(["'])(.*?)\2/gi, `$1data-srcset=$2$3$2`)
		.replace(/background(-image)?:\s*url\(\s*["']?(https?:|\/\/)[^"')]+["']?\s*\)/gi, "background-image: none");
}

// Senders design for a white page, so every message body (HTML or plain text) renders on the same
// light "paper" surface, even in dark mode. The frame never scrolls vertically: it is sized to its
// content so the reader's own scroll area is the only vertical scroller.
const FRAME_STYLE = `
	html { overflow-x: auto; overflow-y: hidden; }
	body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1c1917; word-break: break-word; background: #ffffff; }
	img { max-width: 100% !important; height: auto !important; }
	a { color: #c2410c; text-decoration: underline; }
	pre, code { white-space: pre-wrap; font-family: ui-monospace, monospace; }
	table { max-width: 100% !important; }
	img[data-src] { width: 40px !important; height: 40px !important; opacity: 0.6; }
	img[data-src][width="1"], img[data-src][height="1"] { display: none !important; }
	.plain { white-space: pre-wrap; }
`;

// The CSP is the real boundary: the regex rewrite below only swaps in friendly placeholders.
// Without it, `<td background>`, `<link>`, `@import` and non-background `url()` could still
// load remote content and report that the message was opened.
function buildSrcDoc(body: string, allowRemote: boolean): string {
	const csp = [
		"default-src 'none'",
		`img-src data: ${allowRemote ? "https: http:" : ""}`.trim(),
		"style-src 'unsafe-inline'",
		"font-src data:",
		"base-uri 'none'",
		"form-action 'none'",
	].join("; ");
	return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1"><base target="_blank"><style>${FRAME_STYLE}</style></head><body>${body}</body></html>`;
}

function EmailFrame({ srcDoc }: { srcDoc: string }) {
	const frameRef = useRef<HTMLIFrameElement>(null);
	const observerRef = useRef<ResizeObserver | null>(null);
	const [height, setHeight] = useState(96);

	const measure = useCallback(() => {
		const doc = frameRef.current?.contentDocument;
		if (!doc?.body) return;
		// Body height, not documentElement: the latter never shrinks below the iframe's own height.
		const content = Math.max(Math.ceil(doc.body.getBoundingClientRect().height), doc.body.scrollHeight);
		const root = doc.documentElement;
		const scrollbar = root.scrollWidth > root.clientWidth ? 16 : 0;
		setHeight(Math.max(48, content + scrollbar));
	}, []);

	function handleLoad() {
		observerRef.current?.disconnect();
		const doc = frameRef.current?.contentDocument;
		if (!doc?.body) return;
		// Images and fonts finish after load; keep the frame in step with the content.
		const observer = new ResizeObserver(measure);
		observer.observe(doc.documentElement);
		observer.observe(doc.body);
		observerRef.current = observer;
		measure();
	}

	useEffect(() => () => observerRef.current?.disconnect(), []);

	return (
		<div className="overflow-hidden rounded-lg border bg-white shadow-xs">
			<iframe
				ref={frameRef}
				title="Email content"
				srcDoc={srcDoc}
				sandbox="allow-popups allow-same-origin"
				scrolling="no"
				onLoad={handleLoad}
				style={{ height }}
				className="block w-full border-0"
			/>
		</div>
	);
}

export default function HtmlEmailViewer({ html, text, className }: HtmlEmailViewerProps) {
	const hasHtml = !!html?.trim();
	const hasText = !!text?.trim();
	const [viewMode, setViewMode] = useState<ViewMode>(hasHtml ? "html" : "text");
	const [showImages, setShowImages] = useState(false);
	const [showQuote, setShowQuote] = useState(false);

	useEffect(() => {
		setShowImages(false);
		setShowQuote(false);
		setViewMode(hasHtml ? "html" : "text");
	}, [html, text, hasHtml]);

	if (!hasHtml && !hasText) {
		return (
			<div className={cn("rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground italic", className)}>
				No message content
			</div>
		);
	}

	const plain = hasText ? (text as string) : htmlToText(html);
	const { content, quote } = stripQuotedReply(plain);
	const containsRemote = hasHtml ? hasRemoteResources(html as string) : false;
	const showingHtml = viewMode === "html" && hasHtml;
	const showingText = !showingHtml && viewMode !== "source";

	return (
		<div className={cn("flex flex-col gap-2", className)}>
			{showingHtml && containsRemote && !showImages && (
				<Alert variant="warning" className="flex items-center gap-2 py-1.5 text-xs">
					<ShieldAlert className="size-4 shrink-0" />
					<span className="flex-1">Remote images and tracking pixels are blocked.</span>
					<Button variant="ghost" size="xs" onClick={() => setShowImages(true)}>
						<ImageIcon /> Load images
					</Button>
				</Alert>
			)}

			{hasHtml && (
				<ToggleGroup
					value={[viewMode]}
					onValueChange={(v) => v[0] && setViewMode(v[0] as ViewMode)}
					variant="outline"
					size="sm"
					spacing={0}
					className="self-start"
				>
					<ToggleGroupItem value="html">Rich</ToggleGroupItem>
					<ToggleGroupItem value="text">Plain</ToggleGroupItem>
					<ToggleGroupItem value="source">Source</ToggleGroupItem>
				</ToggleGroup>
			)}

			{showingHtml ? (
				<EmailFrame
					srcDoc={buildSrcDoc(
						showImages ? (html as string) : stripRemoteResources(html as string),
						showImages,
					)}
				/>
			) : showingText ? (
				<>
					<EmailFrame
						srcDoc={buildSrcDoc(
							`<div class="plain">${textToHtml(showQuote || !quote ? plain : content)}</div>`,
							false,
						)}
					/>
					{quote && (
						<Button
							type="button"
							variant="ghost"
							size="xs"
							onClick={() => setShowQuote((v) => !v)}
							className="-ml-2 self-start text-muted-foreground"
						>
							{showQuote ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
							{showQuote ? "Hide quoted text" : "Show quoted text"}
						</Button>
					)}
				</>
			) : (
				<pre className="rounded-lg border bg-muted/40 p-4 font-mono text-xs break-all whitespace-pre-wrap text-muted-foreground">
					{html}
				</pre>
			)}
		</div>
	);
}
