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

// ── Needs attention and drift monitoring ──────────────────────────────────────

/**
 * What is wrong with a domain right now. Receiving only counts when the domain has mailboxes: a
 * sending-only domain that was set up without receiving is working as intended.
 */
export function issuesOf(health: Pick<DomainHealth, "sending" | "receiving" | "mailboxes">): string[] {
	const issues: string[] = [];
	if (health.sending === "pending") issues.push("Sending is not confirmed by Cloudflare");
	if (health.mailboxes > 0 && health.receiving === "off")
		issues.push("Receiving is off, so its mailboxes get no mail");
	if (health.mailboxes > 0 && health.receiving === "elsewhere") issues.push("Incoming mail is routed somewhere else");
	return issues;
}

/** True when Cloudflare could not tell us enough to call the domain healthy or not. */
function isUnknown(health: Pick<DomainHealth, "sending" | "receiving">): boolean {
	return health.sending === "unknown" || health.receiving === "unknown";
}

export interface MonitorState {
	/** Consecutive checks in which the domain had an issue. */
	bad: number;
	alerted: boolean;
}

export interface MonitorEvent {
	type: "degraded" | "recovered";
	domainId: string;
	issues: string[];
}

/** An issue must persist this many checks before anyone is told, so DNS propagation does not page anyone. */
export const ALERT_AFTER_CHECKS = 2;

/**
 * Compares the latest health with what was seen before and says who to tell. A check where
 * Cloudflare could not answer changes nothing, so an outage on their side is never reported as
 * every domain breaking.
 */
export function evaluateHealthChange(
	previous: Record<string, MonitorState>,
	health: DomainHealth[],
): { state: Record<string, MonitorState>; events: MonitorEvent[] } {
	const state: Record<string, MonitorState> = {};
	const events: MonitorEvent[] = [];

	for (const h of health) {
		const before = previous[h.id] ?? { bad: 0, alerted: false };
		const issues = issuesOf(h);

		if (issues.length === 0 && isUnknown(h)) {
			state[h.id] = before;
		} else if (issues.length === 0) {
			if (before.alerted) events.push({ type: "recovered", domainId: h.id, issues: [] });
			state[h.id] = { bad: 0, alerted: false };
		} else {
			const bad = before.bad + 1;
			const alert = !before.alerted && bad >= ALERT_AFTER_CHECKS;
			if (alert) events.push({ type: "degraded", domainId: h.id, issues });
			state[h.id] = { bad, alerted: before.alerted || alert };
		}
	}
	return { state, events };
}
