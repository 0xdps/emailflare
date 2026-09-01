// Inbound email handler — processes DSN (bounce) and ARF (complaint) messages
// that arrive at the return-path address and updates email_logs + suppressions.

import PostalMime from "postal-mime";
import { generateId } from "@emailflare/email-core";
import { createLogger } from "@emailflare/email-core/logger";
import { D1Db } from "./db.ts";
import type { Env } from "./env.ts";

const log = createLogger("email-handler");

// ── Detection helpers ──────────────────────────────────────────────────────────

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

const BOUNCE_FROM_PATTERNS = ["mailer-daemon", "mail-daemon", "postmaster", "bounce"];

const COMPLAINT_SUBJECTS = ["spam complaint", "abuse report", "feedback report", "complaint report"];

const COMPLAINT_FROM_PATTERNS = ["complaints@", "abuse@", "fbl@"];

function isBounce(email: Awaited<ReturnType<PostalMime["parse"]>>): boolean {
	const sub = (email.subject ?? "").toLowerCase();
	const from = (email.from?.address ?? "").toLowerCase();
	return BOUNCE_SUBJECTS.some((p) => sub.includes(p)) || BOUNCE_FROM_PATTERNS.some((p) => from.includes(p));
}

function isComplaint(email: Awaited<ReturnType<PostalMime["parse"]>>): boolean {
	const sub = (email.subject ?? "").toLowerCase();
	const from = (email.from?.address ?? "").toLowerCase();

	// ARF multipart/report with report-type=feedback-report
	const ct = email.headers.find((h) => h.key.toLowerCase() === "content-type")?.value ?? "";
	if (ct.toLowerCase().includes("feedback-report")) return true;

	return COMPLAINT_SUBJECTS.some((p) => sub.includes(p)) || COMPLAINT_FROM_PATTERNS.some((p) => from.includes(p));
}

// ── Content parsing ────────────────────────────────────────────────────────────

/** Extract the bounced/complained-about email address from DSN/ARF text. */
function extractRecipient(content: string): string | null {
	// RFC 3464 structured field (most reliable)
	const finalRcpt = content.match(/Final-Recipient\s*:\s*rfc822\s*;\s*([^\s\r\n<>]+)/i);
	if (finalRcpt) return finalRcpt[1].trim().toLowerCase();

	// ARF Original-Rcpt-To field
	const origRcpt = content.match(/Original-Rcpt-To\s*:\s*([^\s\r\n<>]+)/i);
	if (origRcpt) return origRcpt[1].trim().toLowerCase();

	// <email> angle-bracket form
	const angle = content.match(/<([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})>/);
	if (angle) return angle[1].toLowerCase();

	// "To: email" prose pattern
	const toProse = content.match(/(?:to|for|recipient)\s*:\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
	if (toProse) return toProse[1].toLowerCase();

	return null;
}

/** Determine whether the bounce is permanent (hard), transient (soft), or a spam/policy rejection. */
function classifyBounce(content: string): "hard" | "soft" | "spam_rejection" {
	// RFC 3464 Status field: 5.x.x = permanent, 4.x.x = transient
	const statusField = content.match(/\bStatus\s*:\s*([45]\.\d+\.\d+)/i);
	if (statusField) {
		const code = statusField[1];
		if (code.startsWith("5.7")) return "spam_rejection"; // policy / reputation rejection
		if (code.startsWith("5")) return "hard";
		return "soft";
	}

	// Raw SMTP 5xx codes
	if (/\b5[0-9]{2}\b/.test(content)) return "hard";
	// Raw SMTP 4xx codes
	if (/\b4[0-9]{2}\b/.test(content)) return "soft";

	// Keyword-based spam rejection detection (last resort)
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

	// Common hard-bounce phrases
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

/** Pull a human-readable reason out of the DSN text. */
function extractReason(content: string): string {
	const diagCode = content.match(/Diagnostic-Code\s*:\s*(?:smtp\s*;\s*)?(.+)/i);
	if (diagCode) return diagCode[1].trim().split(/\r?\n/)[0].slice(0, 200);

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

// ── Main handler ───────────────────────────────────────────────────────────────

export async function handleInboundEmail(message: ForwardableEmailMessage, env: Env): Promise<void> {
	let rawBytes: ArrayBuffer;
	try {
		rawBytes = await new Response(message.raw).arrayBuffer();
	} catch {
		log.warn("Failed to read raw message");
		return;
	}

	let email: Awaited<ReturnType<PostalMime["parse"]>>;
	try {
		email = await new PostalMime().parse(rawBytes);
	} catch {
		log.warn("Failed to parse message with PostalMime");
		return;
	}

	const content = [email.text ?? "", email.html ?? ""].join("\n");
	const db = new D1Db(env.DB);
	const now = new Date().toISOString();

	if (isBounce(email)) {
		await processBounce(content, db, now);
		return;
	}

	if (isComplaint(email)) {
		await processComplaint(content, db, now);
		return;
	}
}

// After N soft bounces to the same address we suppress to protect reputation.
const SOFT_BOUNCE_THRESHOLD = 3;

async function processBounce(content: string, db: D1Db, now: string): Promise<void> {
	const recipient = extractRecipient(content);
	if (!recipient) {
		log.warn("Could not extract recipient from bounce, skipping");
		return;
	}

	const bounceType = classifyBounce(content);
	const reason = extractReason(content);

	// Correlate to the most-recent sent log within a 7-day window
	const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
	const logRes = await db.query<{ id: string; domain_id: string | null }>(
		`SELECT id, domain_id FROM email_logs
     WHERE to_address = ? AND status = 'sent' AND sent_at >= ?
     ORDER BY sent_at DESC LIMIT 1`,
		[recipient, cutoff],
	);
	const logRow = logRes.rows[0] ?? null;

	if (logRow) {
		await db.run(`UPDATE email_logs SET status = 'bounced', error = ?, bounced_at = ? WHERE id = ?`, [
			reason,
			now,
			logRow.id,
		]);
	}

	if (bounceType === "hard") {
		// Permanent address failure — suppress immediately.
		await db.run(
			`INSERT OR IGNORE INTO suppressions (id, email, reason, domain_id, email_log_id, created_at)
       VALUES (?, ?, 'hard_bounce', ?, ?, ?)`,
			[generateId(), recipient, logRow?.domain_id ?? null, logRow?.id ?? null, now],
		);
		log.info(`Hard bounce suppressed: ${recipient} — ${reason}`);
		return;
	}

	if (bounceType === "spam_rejection") {
		// Receiving server permanently refused as spam/policy — suppress like a hard bounce
		// to stop sending and protect our sending reputation.
		await db.run(
			`INSERT OR IGNORE INTO suppressions (id, email, reason, domain_id, email_log_id, created_at)
       VALUES (?, ?, 'hard_bounce', ?, ?, ?)`,
			[generateId(), recipient, logRow?.domain_id ?? null, logRow?.id ?? null, now],
		);
		log.info(`Spam rejection suppressed: ${recipient} — ${reason}`);
		return;
	}

	// Soft bounce — suppress only after repeated failures to avoid blocking a
	// temporarily unavailable mailbox.
	const bounceCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
	const countRes = await db.query<{ cnt: number }>(
		`SELECT COUNT(*) AS cnt FROM email_logs
      WHERE to_address = ? AND status = 'bounced' AND sent_at >= ?`,
		[recipient, bounceCutoff],
	);
	const cnt = Number(countRes.rows[0]?.cnt ?? 0);

	if (cnt >= SOFT_BOUNCE_THRESHOLD) {
		await db.run(
			`INSERT OR IGNORE INTO suppressions (id, email, reason, domain_id, email_log_id, created_at)
       VALUES (?, ?, 'soft_bounce', ?, ?, ?)`,
			[generateId(), recipient, logRow?.domain_id ?? null, logRow?.id ?? null, now],
		);
		log.info(`Soft bounce suppressed after ${cnt} bounces: ${recipient}`);
	} else {
		log.info(`Soft bounce logged (${cnt}/${SOFT_BOUNCE_THRESHOLD}): ${recipient} — ${reason}`);
	}
}

async function processComplaint(content: string, db: D1Db, now: string): Promise<void> {
	const recipient = extractRecipient(content);
	if (!recipient) {
		log.warn("Could not extract recipient from complaint, skipping");
		return;
	}

	// Use a 30-day window for complaints (FBL delivery can lag)
	const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
	const logRes = await db.query<{ id: string; domain_id: string | null }>(
		`SELECT id, domain_id FROM email_logs
     WHERE to_address = ? AND status = 'sent' AND sent_at >= ?
     ORDER BY sent_at DESC LIMIT 1`,
		[recipient, cutoff],
	);
	const logRow = logRes.rows[0] ?? null;

	if (logRow) {
		await db.run(`UPDATE email_logs SET status = 'complained', bounced_at = ? WHERE id = ?`, [now, logRow.id]);
	}

	// All complaints go into the suppression list
	await db.run(
		`INSERT OR IGNORE INTO suppressions (id, email, reason, domain_id, email_log_id, created_at)
     VALUES (?, ?, 'complaint', ?, ?, ?)`,
		[generateId(), recipient, logRow?.domain_id ?? null, logRow?.id ?? null, now],
	);
	log.info(`Complaint suppressed: ${recipient}`);
}
