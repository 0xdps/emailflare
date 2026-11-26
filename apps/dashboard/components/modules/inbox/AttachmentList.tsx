"use client";

import React from "react";
import { Download, File, FileText, Paperclip } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { ThreadItem } from "@/lib/api";
import { formatBytes } from "@/lib/inbox/format";
import { cn } from "@/lib/utils";

type Attachment = NonNullable<ThreadItem["attachments"]>[number];

export function attachmentUrl(id: string, download = false): string {
	return `/api/inbox/attachments/${encodeURIComponent(id)}${download ? "?download=1" : ""}`;
}

// Mirrors the server allow-list: these open in a new tab, everything else downloads.
const isImage = (type: string) => /^image\/(png|jpe?g|gif|webp|avif|bmp)$/i.test(type.split(";")[0].trim());
const opensInBrowser = (type: string) =>
	isImage(type) || /^(application\/pdf|text\/plain)$/i.test(type.split(";")[0].trim());

export default function AttachmentList({ attachments }: { attachments: Attachment[] | undefined }) {
	if (!attachments?.length) return null;

	return (
		<div className="border-t pt-3">
			<p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
				<Paperclip className="size-3.5" />
				{attachments.length} {attachments.length === 1 ? "attachment" : "attachments"}
			</p>
			<ul className="flex flex-wrap gap-2">
				{attachments.map((att) => {
					const viewable = opensInBrowser(att.content_type);
					return (
						<li
							key={att.id}
							className="flex max-w-full items-center rounded-lg border bg-muted/40 text-xs transition-colors hover:bg-muted"
						>
							<a
								href={attachmentUrl(att.id)}
								{...(viewable
									? { target: "_blank", rel: "noopener noreferrer" }
									: { download: att.filename })}
								title={viewable ? `Open ${att.filename}` : `Download ${att.filename}`}
								className="flex min-w-0 items-center gap-2 rounded-l-lg py-1.5 pr-2 pl-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
							>
								{isImage(att.content_type) ? (
									<img
										src={attachmentUrl(att.id)}
										alt=""
										loading="lazy"
										className="size-6 shrink-0 rounded-sm border object-cover"
									/>
								) : att.content_type.toLowerCase().includes("pdf") ? (
									<FileText className="size-4 shrink-0 text-primary" />
								) : (
									<File className="size-4 shrink-0 text-primary" />
								)}
								<span className="max-w-48 truncate font-medium">{att.filename}</span>
								<span className="shrink-0 text-muted-foreground">{formatBytes(att.size)}</span>
							</a>
							<a
								href={attachmentUrl(att.id, true)}
								download={att.filename}
								aria-label={`Download ${att.filename}`}
								title="Download"
								className={cn(buttonVariants({ variant: "ghost", size: "icon-xs" }), "mr-1 shrink-0")}
							>
								<Download />
							</a>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
