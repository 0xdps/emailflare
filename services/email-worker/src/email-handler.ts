// Inbound email handler — processes DSN (bounce) and ARF (complaint) messages
// that arrive at the return-path address and updates email_logs + suppressions.

import PostalMime from "postal-mime";
import {
	classifyBounce,
	extractReason,
	extractRecipient,
	generateId,
	isBounce,
	isComplaint,
} from "@emailflare/email-core";
import { createLogger } from "@emailflare/email-core/logger";
import { D1Db } from "./db.ts";
import type { Env } from "./env.ts";

const log = createLogger("email-handler");

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
