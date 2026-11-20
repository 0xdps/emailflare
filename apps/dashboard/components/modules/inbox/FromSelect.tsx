"use client";

import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Inbox } from "@/lib/api";

interface FromSelectProps {
	inboxes: Inbox[];
	value: string;
	onValueChange: (email: string) => void;
	className?: string;
}

export default function FromSelect({ inboxes, value, onValueChange, className }: FromSelectProps) {
	const items = inboxes.map((ib) => ({
		value: ib.email,
		label: ib.display_name ? `${ib.display_name} <${ib.email}>` : ib.email,
	}));
	return (
		<Select items={items} value={value} onValueChange={(v) => v && onValueChange(v as string)}>
			<SelectTrigger size="sm" className={className} aria-label="Send from">
				<SelectValue placeholder="Choose mailbox" />
			</SelectTrigger>
			<SelectContent>
				{items.map((item) => (
					<SelectItem key={item.value} value={item.value}>
						{item.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
