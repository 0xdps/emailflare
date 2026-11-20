import React from "react";
import { cn } from "@/lib/utils";

const WIDTHS = {
	narrow: "max-w-3xl",
	default: "max-w-5xl",
	wide: "max-w-7xl",
	full: "max-w-none",
} as const;

/** Standard page container: width, padding and vertical rhythm for every dashboard page. */
export function PageShell({
	width = "default",
	className,
	children,
}: {
	width?: keyof typeof WIDTHS;
	className?: string;
	children: React.ReactNode;
}) {
	return <div className={cn("mx-auto w-full space-y-6 p-4 sm:p-6 lg:p-8", WIDTHS[width], className)}>{children}</div>;
}

interface PageHeaderProps {
	title: string;
	description?: React.ReactNode;
	/** Small label above the title, e.g. the section name. */
	eyebrow?: string;
	/** Buttons / controls aligned to the right on wide screens. */
	actions?: React.ReactNode;
	className?: string;
}

export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
	return (
		<header className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
			<div className="min-w-0 space-y-1">
				{eyebrow && (
					<p className="text-2xs font-medium tracking-wider text-muted-foreground uppercase">{eyebrow}</p>
				)}
				<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
				{description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
			</div>
			{actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
		</header>
	);
}
