"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

const GROUPS: Array<{ title: string; items: Array<{ label: string; keys: string[][] }> }> = [
	{
		title: "Navigate",
		items: [
			{ label: "Next / previous thread", keys: [["J"], ["K"]] },
			{ label: "Search threads", keys: [["/"]] },
			{ label: "Close thread", keys: [["Esc"]] },
			{ label: "Go to inbox", keys: [["G", "I"]] },
			{ label: "Command palette", keys: [["⌘", "K"]] },
		],
	},
	{
		title: "Act",
		items: [
			{ label: "Compose", keys: [["C"]] },
			{ label: "Reply", keys: [["R"]] },
			{ label: "Archive", keys: [["E"]] },
			{ label: "Star", keys: [["S"]] },
			{ label: "Mark as unread", keys: [["U"]] },
			{ label: "Send reply", keys: [["⌘", "↵"]] },
		],
	},
];

export default function ShortcutsDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Keyboard shortcuts</DialogTitle>
					<DialogDescription>Work through your inbox without leaving the keyboard.</DialogDescription>
				</DialogHeader>
				<div className="grid gap-6 sm:grid-cols-2">
					{GROUPS.map((group) => (
						<div key={group.title} className="space-y-2">
							<h3 className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
								{group.title}
							</h3>
							<ul className="space-y-2">
								{group.items.map((item) => (
									<li key={item.label} className="flex items-center justify-between gap-3 text-sm">
										<span>{item.label}</span>
										<span className="flex items-center gap-1">
											{item.keys.map((combo, i) => (
												<KbdGroup key={i}>
													{combo.map((key) => (
														<Kbd key={key}>{key}</Kbd>
													))}
												</KbdGroup>
											))}
										</span>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}
