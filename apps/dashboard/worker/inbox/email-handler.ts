// Cloudflare Email Workers handler.
// Parses inbound email via postal-mime, upserts person, stores in D1.
// Large bodies (> 512KB) are stored in R2; the D1 row stores the R2 key.
//
// Registered as `email` export in index.ts.

import PostalMime from "postal-mime";
import {
	createLogger,
	classifyBounce,
	extractReason,
	extractRecipient,
	generateId,
	isBounce,
	isComplaint,
	parseThreadToken,
	stripThreadToken,
	threadMessageId,
	upsertPerson,
	resolveThreadId,
} from "@/lib/core";
import { D1Db } from "./db.ts";
import type { Env } from "./env.ts";

const log = createLogger("emailflare-email");
const LARGE_BODY_THRESHOLD = 512 * 1024; // 512 KB
const SOFT_BOUNCE_THRESHOLD = 3;

export async function handleIncomingEmail(message: ForwardableEmailMessage, env: Env): Promise<void> {
	const raw = await new Response(message.raw).arrayBuffer();
	const email = await PostalMime.parse(raw);
	const db = new D1Db(env.DB);
	const now = new Date().toISOString();
	const content = [email.text ?? "", email.html ?? ""].join("\n");

	// Bounces and complaints never become inbox threads.
	if (isBounce(email)) {
		await processBounce(content, db, now);
		return;
	}
	if (isComplaint(email)) {
		await processComplaint(content, db, now);
		return;
	}

	const fromAddress = message.from.toLowerCase();
	const toAddress = message.to.toLowerCase();

	// ── Resolve thread token (plus-address Reply-To) ────────────────────────────
	// If the recipient replied via the +ef_<token> address we set in Reply-To,
	// link this reply to the sent message that carried that token.
	const threadToken = parseThreadToken(toAddress);
	const baseAddress = stripThreadToken(toAddress);

	// ── Resolve inbox ───────────────────────────────────────────────────────────
	const inboxRow = await env.DB.prepare("SELECT email FROM inboxes WHERE email = ? LIMIT 1")
		.bind(baseAddress)
		.first<{ email: string }>();

	const inboxAddress = inboxRow?.email ?? baseAddress;

	// ── Upsert person (scoped to this inbox) ────────────────────────────────────
	const personId = await upsertPerson(db, fromAddress, inboxAddress, {
		name: email.from?.name ?? null,
		generateId,
	});

	// ── Store body (R2 if large, D1 inline otherwise) ──────────────────────────
	const bodyHtml = email.html ?? null;
	const bodyText = email.text ?? null;
	const bodyBytes = bodyHtml ? new TextEncoder().encode(bodyHtml) : null;
	const isLarge = bodyBytes ? bodyBytes.byteLength > LARGE_BODY_THRESHOLD : false;

	let bodyR2Key: string | null = null;
	let storedBodyHtml: string | null = bodyHtml;

	if (isLarge && bodyBytes) {
		bodyR2Key = `emails/${generateId()}.html`;
		await env.ATTACHMENTS.put(bodyR2Key, bodyBytes, {
			httpMetadata: { contentType: "text/html; charset=utf-8" },
		});
		storedBodyHtml = null; // stored in R2
	}

	// ── Insert email row ────────────────────────────────────────────────────────
	const emailId = generateId();
	const messageId = email.messageId ?? null;
	// If this is a reply via our +ef_<token> Reply-To address, thread it to the
	// sent message that carried that token (using our synthetic Message-ID).
	const tokenParent = threadToken ? threadMessageId(threadToken) : null;
	const inReplyTo = email.inReplyTo ?? tokenParent;
	const references = email.references ?? (tokenParent ? tokenParent : null);

	// Resolve thread_id: reply inherits its parent's thread; otherwise new thread.
	const threadId = await resolveThreadId(db, tokenParent ?? email.inReplyTo, {
		generateId,
		references,
		subject: email.subject,
		personId,
		inboxAddress,
	});

	await env.DB.prepare(
		`INSERT INTO inbox_emails
       (id, person_id, thread_id, inbox_address, subject, body_html, body_text, body_r2_key,
        message_id, in_reply_to, "references", spf, dkim, dmarc, is_read, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT (message_id) DO NOTHING`,
	)
		.bind(
			emailId,
			personId,
			threadId,
			inboxAddress,
			email.subject ?? "(no subject)",
			storedBodyHtml,
			bodyText,
			bodyR2Key,
			messageId,
			inReplyTo,
			references,
			message.headers.get("Authentication-Results-SPF") ?? null,
			message.headers.get("Authentication-Results-DKIM") ?? null,
			message.headers.get("Authentication-Results-DMARC") ?? null,
			now,
		)
		.run();

	// ── Store attachments in R2 ─────────────────────────────────────────────────
	if (email.attachments?.length) {
		for (const att of email.attachments) {
			const r2Key = `attachments/${emailId}/${generateId()}_${att.filename ?? "file"}`;
			// Normalize content to ArrayBuffer for R2 and size calculation
			const rawContent = att.content;
			const contentBuf: ArrayBuffer =
				rawContent instanceof ArrayBuffer
					? rawContent
					: rawContent instanceof Uint8Array
						? (rawContent.buffer as ArrayBuffer)
						: (new TextEncoder().encode(rawContent as string).buffer as ArrayBuffer);

			await env.ATTACHMENTS.put(r2Key, contentBuf, {
				httpMetadata: { contentType: att.mimeType ?? "application/octet-stream" },
			});
			await env.DB.prepare(
				`INSERT INTO attachments (id, email_id, filename, content_type, r2_key, size, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
			)
				.bind(
					generateId(),
					emailId,
					att.filename ?? "attachment",
					att.mimeType ?? "application/octet-stream",
					r2Key,
					contentBuf.byteLength,
					now,
				)
				.run();
		}
	}

	// ── Notify inbox members via Durable Object ─────────────────────────────────
	try {
		const members = await env.DB.prepare(
			`SELECT user_id FROM inbox_members
       WHERE inbox_id = (SELECT id FROM inboxes WHERE email = ? LIMIT 1)`,
		)
			.bind(inboxAddress)
			.all<{ user_id: string }>();

		for (const { user_id } of members.results ?? []) {
			const id = env.NOTIFICATIONS.idFromName(user_id);
			const stub = env.NOTIFICATIONS.get(id);
			await stub.fetch("https://do.internal/notify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ type: "new_email", emailId, from: fromAddress, subject: email.subject }),
			});
		}
	} catch {
		// Non-fatal: best-effort notification
	}
}

async function processBounce(content: string, db: D1Db, now: string): Promise<void> {
	const recipient = extractRecipient(content);
	if (!recipient) {
		log.warn("Could not extract recipient from bounce, skipping");
		return;
	}

	const bounceType = classifyBounce(content);
	const reason = extractReason(content);
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

	if (bounceType === "hard" || bounceType === "spam_rejection") {
		await db.run(
			`INSERT OR IGNORE INTO suppressions (id, email, reason, domain_id, email_log_id, created_at)
       VALUES (?, ?, 'hard_bounce', ?, ?, ?)`,
			[generateId(), recipient, logRow?.domain_id ?? null, logRow?.id ?? null, now],
		);
		log.info(`Bounce suppressed: ${recipient} — ${reason}`);
		return;
	}

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
		return;
	}
	log.info(`Soft bounce logged (${cnt}/${SOFT_BOUNCE_THRESHOLD}): ${recipient} — ${reason}`);
}

async function processComplaint(content: string, db: D1Db, now: string): Promise<void> {
	const recipient = extractRecipient(content);
	if (!recipient) {
		log.warn("Could not extract recipient from complaint, skipping");
		return;
	}

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

	await db.run(
		`INSERT OR IGNORE INTO suppressions (id, email, reason, domain_id, email_log_id, created_at)
     VALUES (?, ?, 'complaint', ?, ?, ?)`,
		[generateId(), recipient, logRow?.domain_id ?? null, logRow?.id ?? null, now],
	);
	log.info(`Complaint suppressed: ${recipient}`);
}
