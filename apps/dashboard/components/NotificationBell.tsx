"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications, type NotificationMessage } from "@/hooks/useNotifications";

export default function NotificationBell() {
	const [items, setItems] = useState<NotificationMessage[]>([]);
	const [open, setOpen] = useState(false);
	const { connected } = useNotifications((msg) => {
		if (msg.type === "new_email") setItems((prev) => [msg, ...prev].slice(0, 20));
	});

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={<Button variant="ghost" size="icon" className="relative" aria-label="Notifications" />}
			>
				<Bell />
				{items.length > 0 && (
					<span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
				)}
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80 gap-1 p-1">
				<PopoverHeader className="flex-row items-center justify-between px-2 py-1.5">
					<PopoverTitle className="text-sm">Notifications</PopoverTitle>
					<div className="flex items-center gap-2">
						<span className="text-2xs text-muted-foreground">{connected ? "Live" : "Reconnecting"}</span>
						{items.length > 0 && (
							<Button variant="ghost" size="xs" onClick={() => setItems([])}>
								Clear
							</Button>
						)}
					</div>
				</PopoverHeader>
				{items.length === 0 ? (
					<p className="px-2 py-6 text-center text-xs text-muted-foreground">New mail will show up here.</p>
				) : (
					<ul className="max-h-80 overflow-auto">
						{items.map((item, index) => (
							<li key={`${item.emailId ?? item.threadId ?? index}`}>
								<Link
									href={item.threadId ? `/inbox?thread=${item.threadId}` : "/inbox"}
									onClick={() => setOpen(false)}
									className="block rounded-md px-2 py-2 hover:bg-accent"
								>
									<p className="truncate text-sm font-medium">
										{String(item.subject ?? "New message")}
									</p>
									<p className="truncate text-xs text-muted-foreground">{String(item.from ?? "")}</p>
								</Link>
							</li>
						))}
					</ul>
				)}
			</PopoverContent>
		</Popover>
	);
}
