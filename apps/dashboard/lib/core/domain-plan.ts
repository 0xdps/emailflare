/**
 * Turns what is already in a Cloudflare zone into a plain-language plan of what enabling a
 * domain will do. Pure, so every rule can be tested without calling Cloudflare.
 */

export type MxState = "none" | "cloudflare" | "other" | "unknown";
export type CatchAllState = "none" | "ours" | "elsewhere" | "off" | "unknown";

export interface DomainFacts {
	zoneName: string;
	sendingName: string;
	registered: boolean;
	sendingSubdomain: "exists" | "new";
	/** Only known when the sending subdomain already exists and its records can be compared. */
	sendingRecords: { present: number; missing: number } | null;
	mx: { state: MxState; hosts: string[] };
	catchAll: { state: CatchAllState; target: string | null };
	dmarc: "present" | "absent" | "unknown";
}

export type PlanAction = "add" | "keep" | "replace" | "skip" | "info";

export interface PlanItem {
	id: "sending" | "dns" | "routing" | "dmarc";
	action: PlanAction;
	title: string;
	detail: string;
}

export interface DomainPlan {
	items: PlanItem[];
	warnings: string[];
	/** What to preselect for "receive mail on this domain". */
	receivingDefault: boolean;
	/** Set when enabling must not proceed, with the reason. */
	blocked: string | null;
}

export function classifyMx(hosts: string[]): MxState {
	if (hosts.length === 0) return "none";
	return hosts.every((h) => h.toLowerCase().replace(/\.$/, "").endsWith(".mx.cloudflare.net"))
		? "cloudflare"
		: "other";
}

/**
 * Receiving is only preselected when it cannot take mail away from somewhere else: not when the
 * zone's MX points at another provider, and not when a catch-all already sends mail elsewhere.
 */
export function receivingRecommended(facts: DomainFacts): boolean {
	if (facts.catchAll.state === "ours") return true;
	if (facts.catchAll.state === "elsewhere") return false;
	return facts.mx.state !== "other";
}

export function buildPlan(facts: DomainFacts, opts: { receiving: boolean }): DomainPlan {
	const items: PlanItem[] = [];
	const warnings: string[] = [];

	items.push(
		facts.sendingSubdomain === "exists"
			? {
					id: "sending",
					action: "keep",
					title: `Use the existing sending domain ${facts.sendingName}`,
					detail: "It is already set up in Cloudflare Email Sending.",
				}
			: {
					id: "sending",
					action: "add",
					title: `Create the sending domain ${facts.sendingName}`,
					detail:
						facts.sendingName === facts.zoneName
							? "Mail will be sent from your main domain."
							: "Mail will be sent from this subdomain, which keeps your main domain's email untouched.",
				},
	);

	const missing = facts.sendingRecords?.missing;
	items.push(
		facts.sendingRecords && missing === 0
			? {
					id: "dns",
					action: "keep",
					title: "Sending DNS records are already in place",
					detail: `${facts.sendingRecords.present} records (SPF, DKIM, return path) match what Cloudflare expects.`,
				}
			: {
					id: "dns",
					action: "add",
					title: "Add sending DNS records",
					detail:
						missing !== undefined
							? `${missing} of ${(facts.sendingRecords?.present ?? 0) + missing} records (SPF, DKIM, return path) are missing and will be added to the zone.`
							: "SPF, DKIM and return-path records will be added to the zone. Their names are shown once the sending domain exists.",
				},
	);

	if (!opts.receiving) {
		items.push({
			id: "routing",
			action: "skip",
			title: "Leave receiving mail unchanged",
			detail:
				facts.catchAll.state === "elsewhere"
					? `Incoming mail keeps going to ${facts.catchAll.target ?? "its current destination"}.`
					: "No Email Routing changes. Mailboxes on this domain will not receive mail until you turn receiving on.",
		});
	} else if (facts.catchAll.state === "ours") {
		items.push({
			id: "routing",
			action: "keep",
			title: "Receiving is already routed to this inbox",
			detail: "The zone's catch-all rule already points at this Worker.",
		});
	} else if (facts.catchAll.state === "elsewhere") {
		items.push({
			id: "routing",
			action: "replace",
			title: "Replace the catch-all rule so mail reaches this inbox",
			detail: `It currently sends mail to ${facts.catchAll.target ?? "another destination"}.`,
		});
		warnings.push(
			`The zone's catch-all currently sends mail to ${facts.catchAll.target ?? "another destination"}. Turning receiving on replaces it, and that mail will arrive here instead.`,
		);
	} else {
		items.push({
			id: "routing",
			action: "add",
			title: "Turn on Email Routing and send the catch-all to this inbox",
			detail: "Cloudflare will deliver mail for any address on this domain to this Worker.",
		});
	}

	if (opts.receiving && facts.mx.state === "other") {
		warnings.push(
			`${facts.zoneName} receives mail through ${facts.mx.hosts.join(", ")}. Email Routing needs Cloudflare's MX records, so enabling it can interrupt mail delivered there today. Consider using a subdomain for receiving or leaving receiving off.`,
		);
	}

	if (facts.dmarc === "absent") {
		items.push({
			id: "dmarc",
			action: "info",
			title: "No DMARC record found",
			detail: "Not required to enable the domain, but recommended so receivers trust your mail.",
		});
	}

	return {
		items,
		warnings,
		receivingDefault: receivingRecommended(facts),
		blocked: facts.registered ? `${facts.sendingName} is already set up in EmailFlare.` : null,
	};
}

// ── Staged apply ──────────────────────────────────────────────────────────────

export const DOMAIN_STEPS = ["sending", "dns", "routing", "save"] as const;
export type DomainStep = (typeof DOMAIN_STEPS)[number];

export const STEP_LABEL: Record<DomainStep, string> = {
	sending: "Create sending domain",
	dns: "Publish DNS records",
	routing: "Route incoming mail",
	save: "Save to EmailFlare",
};

export interface StepRecord {
	type: string;
	name: string;
	content: string;
	ttl: number;
	priority?: number;
}

export interface StepResult {
	step: DomainStep;
	/** done: finished. warning: finished but needs the reader to act. failed: can be retried. skipped: not requested. */
	status: "done" | "warning" | "failed" | "skipped";
	message: string;
	/** Records the reader must add by hand when they could not be written. */
	records?: StepRecord[];
	dnsStatus?: "written" | "manual";
	routing?: "ready" | "pending";
	/** HTTP-style class of a failure, used by the API route. */
	httpStatus?: 409 | 422 | 502;
	cfCode?: number | null;
	cfPath?: string | null;
}
