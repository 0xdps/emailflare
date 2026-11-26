/**
 * What a domain can do right now, derived from Cloudflare rather than from what we
 * remembered at setup time. Pure so the rules are testable without the API.
 */

export type SendingHealth = "ready" | "pending" | "unknown";
export type ReceivingHealth = "ready" | "elsewhere" | "off" | "unknown";

export interface DomainHealth {
	id: string;
	sending: SendingHealth;
	receiving: ReceivingHealth;
	/** Where mail goes when receiving is "elsewhere", e.g. a Worker name or forwarding address. */
	receivingTarget: string | null;
	mailboxes: number;
	checkedAt: string;
}

export interface CatchAllRuleView {
	enabled: boolean;
	actions?: Array<{ type: string; value?: string[] }>;
}

/** `enabled` is null when Cloudflare could not be asked, which must not read as "not ready". */
export function deriveSending(enabled: boolean | null | undefined): SendingHealth {
	if (enabled === null || enabled === undefined) return "unknown";
	return enabled ? "ready" : "pending";
}

export function deriveReceiving(
	rule: CatchAllRuleView | null | undefined,
	workerName: string,
): { state: ReceivingHealth; target: string | null } {
	if (!rule) return { state: "unknown", target: null };
	if (!rule.enabled) return { state: "off", target: null };

	const actions = rule.actions ?? [];
	if (actions.some((a) => a.type === "worker" && a.value?.includes(workerName))) {
		return { state: "ready", target: null };
	}
	const other = actions[0];
	return { state: "elsewhere", target: other ? `${other.type}: ${(other.value ?? []).join(", ")}` : null };
}

export const SENDING_LABEL: Record<SendingHealth, string> = {
	ready: "Sending ready",
	pending: "Sending waiting for DNS",
	unknown: "Sending not checked",
};

export const RECEIVING_LABEL: Record<ReceivingHealth, string> = {
	ready: "Receiving ready",
	elsewhere: "Receiving goes elsewhere",
	off: "Receiving off",
	unknown: "Receiving not checked",
};

/** Plain-English reason shown next to a state that needs attention. */
export function healthHint(health: Pick<DomainHealth, "sending" | "receiving" | "receivingTarget">): string | null {
	if (health.receiving === "elsewhere") {
		return `Incoming mail is routed ${health.receivingTarget ? `to ${health.receivingTarget}` : "to another destination"}, not to this inbox. Mailboxes here will not receive mail until the catch-all points at EmailFlare.`;
	}
	if (health.receiving === "off") {
		return "Email Routing has no active catch-all rule, so mailboxes here will not receive mail.";
	}
	if (health.sending === "pending") {
		return "Cloudflare has not confirmed the sending DNS records yet. This can take a few minutes after they are added.";
	}
	return null;
}
