"use client";

import React, { useState, useEffect, useRef } from "react";
import { Code, Eye, FileText, ShieldAlert, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface HtmlEmailViewerProps {
	html: string | null;
	text: string | null;
	className?: string;
}

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

export default function HtmlEmailViewer({ html, text, className }: HtmlEmailViewerProps) {
	const [viewMode, setViewMode] = useState<"html" | "text" | "source">(html ? "html" : "text");
	const [showImages, setShowImages] = useState(false);
	const [frameHeight, setFrameHeight] = useState(160);
	const frameRef = useRef<HTMLIFrameElement>(null);

	function resizeFrame() {
		const doc = frameRef.current?.contentDocument;
		const next = doc?.documentElement?.scrollHeight ?? doc?.body?.scrollHeight;
		if (next) setFrameHeight(Math.max(120, next));
	}

	// Reset image loading when email changes
	useEffect(() => {
		setShowImages(false);
	}, [html]);

	const containsRemote = html ? hasRemoteResources(html) : false;
	const processedHtml = html ? (showImages ? html : stripRemoteResources(html)) : "";

	const srcDocContent = `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<base target="_blank">
	<style>
		body {
			margin: 0;
			padding: 16px;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
			font-size: 14px;
			line-height: 1.6;
			color: #18181b;
			word-break: break-word;
			background-color: transparent;
		}
		img {
			max-width: 100% !important;
			height: auto !important;
		}
		a {
			color: #ea580c;
			text-decoration: underline;
		}
		pre, code {
			white-space: pre-wrap;
			font-family: monospace;
		}
		table {
			max-width: 100% !important;
		}
	</style>
</head>
<body>
	${processedHtml}
</body>
</html>`;

	const hasBoth = !!html && !!text;

	return (
		<div className={cn("flex flex-col rounded-lg border border-border/80 overflow-hidden bg-card", className)}>
			{/* Remote images privacy banner */}
			{viewMode === "html" && containsRemote && !showImages && (
				<div className="flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
					<div className="flex items-center gap-2">
						<ShieldAlert size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
						<span>Images and tracking pixels are blocked to protect your privacy.</span>
					</div>
					<button
						type="button"
						onClick={() => setShowImages(true)}
						className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:underline cursor-pointer ml-3 shrink-0"
					>
						<ImageIcon size={12} />
						Load remote images
					</button>
				</div>
			)}

			{/* Format selector toolbar */}
			{hasBoth && (
				<div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60 bg-muted/30 text-xs">
					<span className="text-[11px] text-muted-foreground font-medium">Message Body</span>
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={() => setViewMode("html")}
							className={cn(
								"inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer",
								viewMode === "html"
									? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<Eye size={11} />
							HTML
						</button>
						<button
							type="button"
							onClick={() => setViewMode("text")}
							className={cn(
								"inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer",
								viewMode === "text"
									? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<FileText size={11} />
							Text
						</button>
						<button
							type="button"
							onClick={() => setViewMode("source")}
							className={cn(
								"inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer",
								viewMode === "source"
									? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<Code size={11} />
							Source
						</button>
					</div>
				</div>
			)}

			{/* Viewport */}
			<div className="relative overflow-hidden">
				{viewMode === "html" && html ? (
					<iframe
						ref={frameRef}
						title="Email Content"
						srcDoc={srcDocContent}
						sandbox="allow-popups allow-same-origin"
						onLoad={resizeFrame}
						style={{ height: frameHeight }}
						className="w-full border-0 block"
					/>
				) : viewMode === "source" && html ? (
					<pre className="p-4 text-xs font-mono text-zinc-700 dark:text-zinc-300 bg-muted/40 overflow-x-auto whitespace-pre-wrap max-h-[500px]">
						{html}
					</pre>
				) : (
					<div className="p-4 text-[13.5px] text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans">
						{text || <span className="text-muted-foreground italic">No content available</span>}
					</div>
				)}
			</div>
		</div>
	);
}
