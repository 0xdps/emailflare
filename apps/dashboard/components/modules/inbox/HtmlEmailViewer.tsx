"use client";

import React, { useEffect, useRef, useState } from "react";
import { ImageIcon, ShieldAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

// Senders design for a white page, so HTML mail always renders on a light "paper" surface, even in dark mode.
const FRAME_STYLE = `
	body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1c1917; word-break: break-word; background: #ffffff; }
	img { max-width: 100% !important; height: auto !important; }
	a { color: #c2410c; text-decoration: underline; }
	pre, code { white-space: pre-wrap; font-family: ui-monospace, monospace; }
	table { max-width: 100% !important; }
`;

export default function HtmlEmailViewer({ html, text, className }: HtmlEmailViewerProps) {
	const [viewMode, setViewMode] = useState<ViewMode>(html ? "html" : "text");
	const [showImages, setShowImages] = useState(false);
	const [frameHeight, setFrameHeight] = useState(160);
	const frameRef = useRef<HTMLIFrameElement>(null);

	function resizeFrame() {
		const doc = frameRef.current?.contentDocument;
		const next = doc?.documentElement?.scrollHeight ?? doc?.body?.scrollHeight;
		if (next) setFrameHeight(Math.max(120, next));
	}

	useEffect(() => {
		setShowImages(false);
	}, [html]);

	const containsRemote = html ? hasRemoteResources(html) : false;
	const processedHtml = html ? (showImages ? html : stripRemoteResources(html)) : "";

	const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base target="_blank"><style>${FRAME_STYLE}</style></head><body>${processedHtml}</body></html>`;
	const hasBoth = !!html && !!text;

	return (
		<div className={cn("flex flex-col gap-2", className)}>
			{viewMode === "html" && containsRemote && !showImages && (
				<Alert variant="warning" className="flex items-center gap-2 py-1.5 text-xs">
					<ShieldAlert className="size-4 shrink-0" />
					<span className="flex-1">Remote images and tracking pixels are blocked.</span>
					<Button variant="ghost" size="xs" onClick={() => setShowImages(true)}>
						<ImageIcon /> Load images
					</Button>
				</Alert>
			)}

			{hasBoth && (
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

			{viewMode === "html" && html ? (
				<div className="overflow-hidden rounded-lg border bg-white shadow-xs">
					<iframe
						ref={frameRef}
						title="Email content"
						srcDoc={srcDoc}
						sandbox="allow-popups allow-same-origin"
						onLoad={resizeFrame}
						style={{ height: frameHeight }}
						className="block w-full border-0"
					/>
				</div>
			) : viewMode === "source" && html ? (
				<pre className="max-h-[500px] overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
					{html}
				</pre>
			) : (
				<div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
					{text || <span className="text-muted-foreground italic">No content available</span>}
				</div>
			)}
		</div>
	);
}
