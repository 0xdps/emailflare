"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Clock, HelpCircle, Inbox, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
	RECEIVING_LABEL,
	SENDING_LABEL,
	healthHint,
	type DomainHealth,
	type ReceivingHealth,
	type SendingHealth,
} from "@/lib/core/domain-health";

type Tone = { variant: "success" | "warning" | "outline"; icon: React.ElementType };

const SENDING_STYLE: Record<SendingHealth, Tone> = {
	ready: { variant: "success", icon: CheckCircle2 },
	pending: { variant: "warning", icon: Clock },
	unknown: { variant: "outline", icon: HelpCircle },
};

const RECEIVING_STYLE: Record<ReceivingHealth, Tone> = {
	ready: { variant: "success", icon: CheckCircle2 },
	elsewhere: { variant: "warning", icon: AlertTriangle },
	off: { variant: "warning", icon: AlertTriangle },
	unknown: { variant: "outline", icon: HelpCircle },
};

function Chip({
	variant,
	icon: Icon,
	lead: Lead,
	label,
	hint,
}: Tone & { lead: React.ElementType; label: string; hint: string | null }) {
	const chip = (
		<Badge variant={variant}>
			<Lead />
			<span>{label}</span>
			<Icon />
		</Badge>
	);
	if (!hint) return chip;
	return (
		<Tooltip>
			<TooltipTrigger render={<span className="inline-flex cursor-help" />}>{chip}</TooltipTrigger>
			<TooltipContent className="max-w-xs">{hint}</TooltipContent>
		</Tooltip>
	);
}

/** Sending and receiving state for one domain; `health` is undefined while it is being checked. */
export default function HealthChips({ health }: { health: DomainHealth | undefined }) {
	if (!health) {
		return (
			<div className="flex gap-1.5" aria-busy="true" aria-label="Checking domain health">
				<Skeleton className="h-5 w-28 rounded-full" />
				<Skeleton className="h-5 w-28 rounded-full" />
			</div>
		);
	}
	const hint = healthHint(health);
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<Chip
				{...SENDING_STYLE[health.sending]}
				lead={Send}
				label={SENDING_LABEL[health.sending]}
				hint={health.sending === "pending" ? hint : null}
			/>
			<Chip
				{...RECEIVING_STYLE[health.receiving]}
				lead={Inbox}
				label={RECEIVING_LABEL[health.receiving]}
				hint={health.receiving === "elsewhere" || health.receiving === "off" ? hint : null}
			/>
		</div>
	);
}
