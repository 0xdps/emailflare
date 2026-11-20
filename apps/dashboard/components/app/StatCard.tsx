import React from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type Tone = "brand" | "success" | "warning" | "info" | "danger" | "neutral";

/** Icon-chip and text colours per tone. Add new tones here, nowhere else. */
export const TONE_STYLES: Record<Tone, { chip: string; text: string }> = {
	brand: { chip: "bg-primary-muted text-primary-muted-foreground", text: "text-primary" },
	success: { chip: "bg-success-muted text-success-muted-foreground", text: "text-success" },
	warning: { chip: "bg-warning-muted text-warning-muted-foreground", text: "text-warning-muted-foreground" },
	info: { chip: "bg-info-muted text-info-muted-foreground", text: "text-info" },
	danger: { chip: "bg-destructive/10 text-destructive", text: "text-destructive" },
	neutral: { chip: "bg-muted text-muted-foreground", text: "text-muted-foreground" },
};

interface StatCardProps {
	label: string;
	value: React.ReactNode;
	icon?: LucideIcon;
	tone?: Tone;
	/** Small line under the value (delta, caption, badge…). */
	footer?: React.ReactNode;
	loading?: boolean;
	className?: string;
}

export function StatCard({ label, value, icon: Icon, tone = "neutral", footer, loading, className }: StatCardProps) {
	return (
		<Card className={className}>
			<CardContent className="flex h-full flex-col gap-3">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					{Icon && (
						<span
							className={cn("flex size-6 items-center justify-center rounded-md", TONE_STYLES[tone].chip)}
						>
							<Icon className="size-3.5" />
						</span>
					)}
					{label}
				</div>
				{loading ? (
					<Skeleton className="h-8 w-20" />
				) : (
					<p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
				)}
				{footer && <div className="mt-auto text-xs text-muted-foreground">{footer}</div>}
			</CardContent>
		</Card>
	);
}
