"use client";

import React from "react";
import Link from "next/link";
import {
	PenLine,
	Inbox as InboxIcon,
	Mail,
	FlaskConical,
	ListOrdered,
	Users,
	Send,
	Archive,
	Star,
	ChevronRight,
	Plus,
} from "lucide-react";
import { Inbox as InboxType } from "@/lib/api";
import { cn } from "@/lib/utils";

interface InboxNavProps {
	inboxes: InboxType[];
	selectedInbox: string | null; // null means 'all'
	onSelectInbox: (inboxEmail: string | null) => void;
	activeFolder: "inbox" | "test";
	onSelectFolder: (folder: "inbox" | "test") => void;
	canAccessTester: boolean;
	unreadTotal: number;
	onComposeClick: () => void;
	className?: string;
}

export default function InboxNav({
	inboxes,
	selectedInbox,
	onSelectInbox,
	activeFolder,
	onSelectFolder,
	canAccessTester,
	unreadTotal,
	onComposeClick,
	className,
}: InboxNavProps) {
	return (
		<div
			className={cn("flex flex-col h-full border-r border-border bg-sidebar shrink-0 p-2.5 space-y-4", className)}
		>
			{/* Compose Button */}
			<div>
				<button
					type="button"
					onClick={onComposeClick}
					className="w-full flex items-center justify-center gap-2 h-9 px-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium text-xs shadow-xs transition-colors"
				>
					<PenLine size={13} />
					<span>New Message</span>
					<kbd className="ml-auto px-1.5 py-0.5 rounded bg-orange-700/60 text-[10px] font-mono text-orange-100">
						C
					</kbd>
				</button>
			</div>

			{/* Mailboxes Section */}
			<div className="space-y-1">
				<p className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
					Mailboxes
				</p>
				<button
					type="button"
					onClick={() => {
						onSelectFolder("inbox");
						onSelectInbox(null);
					}}
					className={cn(
						"w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left",
						activeFolder === "inbox" && selectedInbox === null
							? "bg-zinc-200/70 text-foreground font-semibold dark:bg-zinc-800"
							: "text-muted-foreground hover:text-foreground hover:bg-muted/60",
					)}
				>
					<div className="flex items-center gap-2 truncate">
						<InboxIcon size={14} className="shrink-0 text-orange-500" />
						<span className="truncate">All Inboxes</span>
					</div>
					{unreadTotal > 0 && (
						<span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-orange-500 text-white tabular-nums">
							{unreadTotal}
						</span>
					)}
				</button>

				{inboxes.map((ib) => {
					const isSelected = activeFolder === "inbox" && selectedInbox === ib.email;
					return (
						<button
							key={ib.id}
							type="button"
							onClick={() => {
								onSelectFolder("inbox");
								onSelectInbox(ib.email);
							}}
							className={cn(
								"w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left group",
								isSelected
									? "bg-zinc-200/70 text-foreground font-semibold dark:bg-zinc-800"
									: "text-muted-foreground hover:text-foreground hover:bg-muted/60",
							)}
						>
							<div className="flex items-center gap-2 truncate">
								<Mail
									size={13}
									className="shrink-0 text-muted-foreground group-hover:text-foreground"
								/>
								<span className="truncate">{ib.display_name || ib.email.split("@")[0]}</span>
							</div>
							<span className="text-[10px] text-muted-foreground/60 truncate max-w-[70px]">
								@{ib.email.split("@")[1]}
							</span>
						</button>
					);
				})}
			</div>

			{/* Testing Section (Only visible to users with tester permission) */}
			{canAccessTester && (
				<div className="space-y-1">
					<p className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
						Testing
					</p>
					<button
						type="button"
						onClick={() => onSelectFolder("test")}
						className={cn(
							"w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left",
							activeFolder === "test"
								? "bg-purple-100 text-purple-900 font-semibold dark:bg-purple-950/60 dark:text-purple-200"
								: "text-purple-700/80 hover:text-purple-950 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950/30",
						)}
					>
						<div className="flex items-center gap-2">
							<FlaskConical size={14} className="shrink-0 text-purple-600 dark:text-purple-400" />
							<span>Test Mailbox</span>
						</div>
						<span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200 uppercase">
							Sandbox
						</span>
					</button>
				</div>
			)}

			{/* Tools & Automations */}
			<div className="space-y-1 pt-1">
				<p className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
					Workflows
				</p>
				<Link
					href="/inbox/sequences"
					className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
				>
					<ListOrdered size={14} className="shrink-0" />
					<span>Drip Sequences</span>
				</Link>
			</div>
		</div>
	);
}
