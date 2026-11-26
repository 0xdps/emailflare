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

/**
 * Mail addresses that belong to a domain. A sending subdomain such as mail.example.com is
 * usually paired with mailboxes on example.com, because that is the zone whose catch-all
 * routes incoming mail, so both names count.
 */
export function mailboxDomains(domainName: string): string[] {
	const labels = domainName.toLowerCase().split(".");
	const names: string[] = [];
	for (let i = 0; i <= labels.length - 2; i++) names.push(labels.slice(i).join("."));
	return names;
}

export function emailBelongsToDomain(email: string, domainName: string): boolean {
	const host = email.toLowerCase().split("@")[1] ?? "";
	return mailboxDomains(domainName).includes(host);
}

export type RecordStatus = "ok" | "missing" | "wrong";

export interface RecordCheck {
	type: string;
	name: string;
	content: string;
	ttl: number;
	status: RecordStatus;
	/** What the zone has instead, when status is "wrong". */
	actual?: string;
}

const normalizeRecordValue = (value: string) => value.replace(/^"|"$/g, "").trim().toLowerCase().replace(/\.$/, "");

/** Compares one expected record with what the zone holds under the same type and name. */
export function checkRecord(
	expected: { type: string; name: string; content: string; ttl: number },
	found: Array<{ content: string }>,
): RecordCheck {
	const want = normalizeRecordValue(expected.content);
	if (found.some((f) => normalizeRecordValue(f.content) === want)) return { ...expected, status: "ok" };
	if (found.length > 0) return { ...expected, status: "wrong", actual: found[0].content };
	return { ...expected, status: "missing" };
}
