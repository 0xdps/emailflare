/**
 * Pure DSN (RFC 3464) and ARF (RFC 5965) classification.
 * No postal-mime dependency — callers pass the already-parsed message.
 */

export interface BounceMessageView {
	subject?: string | null;
	from?: { address?: string | null } | null;
	headers?: Array<{ key: string; value: string }>;
}

export type BounceClass = "hard" | "soft" | "spam_rejection";

const BOUNCE_SUBJECTS = [
	"delivery status notification",
	"mail delivery failed",
	"mail delivery failure",
	"undelivered mail",
	"returned mail",
	"mail system error",
	"delivery failure",
	"delivery notification",
];

const BOUNCE_FROM = ["mailer-daemon", "mail-daemon", "postmaster", "bounce"];

const COMPLAINT_SUBJECTS = ["spam complaint", "abuse report", "feedback report", "complaint report"];
const COMPLAINT_FROM = ["complaints@", "abuse@", "fbl@"];

export function isBounce(email: BounceMessageView): boolean {
	const sub = (email.subject ?? "").toLowerCase();
	const from = (email.from?.address ?? "").toLowerCase();
	return BOUNCE_SUBJECTS.some((p) => sub.includes(p)) || BOUNCE_FROM.some((p) => from.includes(p));
}

export function isComplaint(email: BounceMessageView): boolean {
	const sub = (email.subject ?? "").toLowerCase();
	const from = (email.from?.address ?? "").toLowerCase();
	const ct = (email.headers ?? []).find((h) => h.key.toLowerCase() === "content-type")?.value ?? "";
	if (ct.toLowerCase().includes("feedback-report")) return true;
	return COMPLAINT_SUBJECTS.some((p) => sub.includes(p)) || COMPLAINT_FROM.some((p) => from.includes(p));
}

/** Extract the bounced or complained-about address from DSN/ARF body text. */
export function extractRecipient(content: string): string | null {
	const finalRcpt = content.match(/Final-Recipient\s*:\s*rfc822\s*;\s*([^\s\r\n<>]+)/i);
	if (finalRcpt) return finalRcpt[1].trim().toLowerCase();

	const origRcpt = content.match(/Original-Rcpt-To\s*:\s*([^\s\r\n<>]+)/i);
	if (origRcpt) return origRcpt[1].trim().toLowerCase();

	const angle = content.match(/<([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})>/);
	if (angle) return angle[1].toLowerCase();

	const toProse = content.match(/(?:to|for|recipient)\s*:\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
	if (toProse) return toProse[1].toLowerCase();

	return null;
}

export function classifyBounce(content: string): BounceClass {
	const statusField = content.match(/\bStatus\s*:\s*([45]\.\d+\.\d+)/i);
	if (statusField) {
		const code = statusField[1];
		if (code.startsWith("5.7")) return "spam_rejection";
		if (code.startsWith("5")) return "hard";
		return "soft";
	}
	if (/\b5[0-9]{2}\b/.test(content)) return "hard";
	if (/\b4[0-9]{2}\b/.test(content)) return "soft";
	const spamPhrases = [
		"rejected as spam",
		"blocked as spam",
		"spam policy",
		"blacklisted",
		"blocklisted",
		"policy violation",
		"your ip",
		"sending ip",
		"spam filter",
	];
	if (spamPhrases.some((p) => content.toLowerCase().includes(p))) return "spam_rejection";
	const hardPhrases = [
		"user unknown",
		"no such user",
		"invalid recipient",
		"address rejected",
		"mailbox unavailable",
		"domain not found",
		"5.1.1",
		"5.1.2",
		"5.4.1",
		"does not exist",
	];
	if (hardPhrases.some((p) => content.toLowerCase().includes(p))) return "hard";
	return "soft";
}

export function extractReason(content: string): string {
	const diag = content.match(/Diagnostic-Code\s*:\s*(?:smtp\s*;\s*)?(.+)/i);
	if (diag) return diag[1].trim().split(/\r?\n/)[0].slice(0, 200);
	const patterns = [
		/reason\s*:\s*(.+)/i,
		/error\s*:\s*(.+)/i,
		/(5\.\d+\.\d+[^\n]{0,100})/i,
		/(4\.\d+\.\d+[^\n]{0,100})/i,
	];
	for (const p of patterns) {
		const m = content.match(p);
		if (m) return m[1].trim().split(/\r?\n/)[0].slice(0, 200);
	}
	return "Bounce notification received";
}
