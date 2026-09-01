// Inbound email handler for inbox-server.
// Node.js port of services/inbox-worker/src/email-handler.ts.
//
// Instead of receiving a ForwardableEmailMessage from the CF email() export,
// this handler receives a validated JSON payload from the /webhook/email endpoint
// (posted by the inbox-bridge CF Worker after HMAC verification).

import PostalMime from "postal-mime";
import { generateId } from "@emailflare/email-core";
import {
	parseThreadToken,
	stripThreadToken,
	threadMessageId,
	upsertPerson,
	resolveThreadId,
} from "@emailflare/inbox-core";
import { rawDb } from "./db.js";
import { putObject } from "./storage.js";
import { wsManager } from "./websocket.js";

export interface EmailPayload {
	from: string;
	to: string;
	rawBase64: string; // base64-encoded raw RFC 5322 message
	spf?: string | null;
	dkim?: string | null;
	dmarc?: string | null;
}

const LARGE_BODY_THRESHOLD = 512 * 1024; // 512 KB

export async function handleIncomingEmail(payload: EmailPayload): Promise<void> {
	const rawBuf = Buffer.from(payload.rawBase64, "base64");
	const email = await PostalMime.parse(rawBuf.buffer);

	const fromAddress = payload.from.toLowerCase();
	const toAddress = payload.to.toLowerCase();
	const now = new Date().toISOString();

	// ── Resolve thread token (plus-address Reply-To) ────────────────────────────
	const threadToken = parseThreadToken(toAddress);
	const baseAddress = stripThreadToken(toAddress);

	// ── Resolve inbox ───────────────────────────────────────────────────────────
	const inboxRow = await rawDb.first<{ email: string }>("SELECT email FROM inboxes WHERE email = ? LIMIT 1", [
		baseAddress,
	]);
	const inboxAddress = inboxRow?.email ?? baseAddress;

	// ── Upsert person (scoped to this inbox) ────────────────────────────────────
	const personId = await upsertPerson(rawDb, fromAddress, inboxAddress, {
		name: email.from?.name ?? null,
		generateId,
	});

	// ── Store body (R2 if large, inline otherwise) ─────────────────────────────
	const bodyHtml = email.html ?? null;
	const bodyText = email.text ?? null;
	const bodyBytes = bodyHtml ? new TextEncoder().encode(bodyHtml) : null;
	const isLarge = bodyBytes ? bodyBytes.byteLength > LARGE_BODY_THRESHOLD : false;

	let bodyR2Key: string | null = null;
	let storedBodyHtml: string | null = bodyHtml;

	if (isLarge && bodyBytes) {
		bodyR2Key = `emails/${generateId()}.html`;
		await putObject(bodyR2Key, bodyBytes, "text/html; charset=utf-8");
		storedBodyHtml = null;
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
	const threadId = await resolveThreadId(rawDb, tokenParent ?? email.inReplyTo, { generateId });

	await rawDb.run(
		`INSERT INTO inbox_emails
       (id, person_id, thread_id, inbox_address, subject, body_html, body_text, body_r2_key,
        message_id, in_reply_to, "references", spf, dkim, dmarc, is_read, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT (message_id) DO NOTHING`,
		[
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
			payload.spf ?? null,
			payload.dkim ?? null,
			payload.dmarc ?? null,
			now,
		],
	);

	// ── Store attachments in R2 ─────────────────────────────────────────────────
	if (email.attachments?.length) {
		for (const att of email.attachments) {
			const r2Key = `attachments/${emailId}/${generateId()}_${att.filename ?? "file"}`;
			const rawContent = att.content;
			const buf: Buffer = Buffer.isBuffer(rawContent)
				? rawContent
				: rawContent instanceof ArrayBuffer
					? Buffer.from(rawContent)
					: rawContent instanceof Uint8Array
						? Buffer.from(rawContent.buffer)
						: Buffer.from(rawContent as string);

			await putObject(r2Key, buf, att.mimeType ?? "application/octet-stream");
			await rawDb.run(
				`INSERT INTO attachments (id, email_id, filename, content_type, r2_key, size, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[
					generateId(),
					emailId,
					att.filename ?? "attachment",
					att.mimeType ?? "application/octet-stream",
					r2Key,
					buf.byteLength,
					now,
				],
			);
		}
	}

	// ── Notify inbox members via WebSocket ──────────────────────────────────────
	try {
		const { rows: members } = await rawDb.query<{ user_id: string }>(
			`SELECT user_id FROM inbox_members
       WHERE inbox_id = (SELECT id FROM inboxes WHERE email = ? LIMIT 1)`,
			[inboxAddress],
		);

		for (const { user_id } of members) {
			wsManager.notifyUser(user_id, {
				type: "new_email",
				emailId,
				from: fromAddress,
				subject: email.subject ?? "(no subject)",
			});
		}
	} catch {
		// Non-fatal: best-effort
	}
}
