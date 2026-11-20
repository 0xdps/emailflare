"use client";

import React from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { ThreadItem } from "@/lib/api";
import { cn } from "@/lib/utils";

const CHECKS = [
	{ key: "spf", label: "SPF", hint: "Sending server is authorised for the domain" },
	{ key: "dkim", label: "DKIM", hint: "Message signature is valid" },
	{ key: "dmarc", label: "DMARC", hint: "Domain policy alignment" },
] as const;

/** One shield summarising SPF / DKIM / DMARC; the popover shows the individual verdicts. */
export default function AuthBadge({ item }: { item: Pick<ThreadItem, "spf" | "dkim" | "dmarc"> }) {
	const results = CHECKS.map((c) => ({ ...c, status: item[c.key] })).filter((r) => r.status);
	if (results.length === 0) return null;

	const failed = results.filter((r) => r.status!.toLowerCase() !== "pass");
	const ok = failed.length === 0;
	const Icon = ok ? ShieldCheck : ShieldAlert;

	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button
						variant="ghost"
						size="xs"
						className={cn(
							"h-5 gap-1 px-1.5 text-2xs",
							ok ? "text-success hover:text-success" : "text-destructive hover:text-destructive",
						)}
					/>
				}
			>
				<Icon />
				{ok ? "Authenticated" : `${failed.length} failed`}
			</PopoverTrigger>
			<PopoverContent align="start" className="w-72">
				<PopoverHeader>
					<PopoverTitle>Sender verification</PopoverTitle>
					<PopoverDescription>
						{ok ? "This message passed every check." : "Treat this message with caution."}
					</PopoverDescription>
				</PopoverHeader>
				<ul className="space-y-2">
					{results.map((r) => {
						const pass = r.status!.toLowerCase() === "pass";
						return (
							<li key={r.key} className="flex items-start gap-2 text-xs">
								<span
									className={cn(
										"mt-1 size-1.5 shrink-0 rounded-full",
										pass ? "bg-success" : "bg-destructive",
									)}
								/>
								<span className="flex-1">
									<span className="font-medium">{r.label}</span>
									<span className="block text-muted-foreground">{r.hint}</span>
								</span>
								<span className={cn("font-mono uppercase", pass ? "text-success" : "text-destructive")}>
									{r.status}
								</span>
							</li>
						);
					})}
				</ul>
			</PopoverContent>
		</Popover>
	);
}
