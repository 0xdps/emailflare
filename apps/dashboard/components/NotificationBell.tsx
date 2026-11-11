"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useNotifications, type NotificationMessage } from "@/hooks/useNotifications";

export default function NotificationBell() {
	const [items, setItems] = useState<NotificationMessage[]>([]);
	const [open, setOpen] = useState(false);
	const { connected } = useNotifications((msg) => {
		setItems((prev) => [msg, ...prev].slice(0, 20));
	});

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				className="relative size-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
				aria-label="Notifications"
			>
				<Bell size={16} />
				{items.length > 0 && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-orange-500" />}
			</button>
			{open && (
				<div className="absolute right-0 top-9 z-30 w-72 rounded-xl border bg-popover p-2 shadow-lg">
					<div className="flex items-center justify-between px-2 py-1">
						<p className="text-xs font-medium">Notifications</p>
						<span className="text-[10px] text-muted-foreground">{connected ? "Live" : "Reconnecting"}</span>
					</div>
					{items.length === 0 ? (
						<p className="px-2 py-4 text-xs text-muted-foreground">New mail will show up here.</p>
					) : (
						<ul className="max-h-72 overflow-auto">
							{items.map((item, index) => (
								<li key={`${item.emailId ?? item.threadId ?? index}`}>
									<Link
										href={item.threadId ? `/inbox?thread=${item.threadId}` : "/inbox"}
										onClick={() => setOpen(false)}
										className="block rounded-lg px-2 py-2 hover:bg-muted"
									>
										<p className="truncate text-xs font-medium">
											{String(item.subject ?? "New message")}
										</p>
										<p className="truncate text-[11px] text-muted-foreground">
											{String(item.from ?? "")}
										</p>
									</Link>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	);
}
