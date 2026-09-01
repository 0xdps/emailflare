// Cloudflare Email Workers handler.
// Parses inbound email via postal-mime, upserts person, stores in D1.
// Large bodies (> 512KB) are stored in R2; the D1 row stores the R2 key.
//
// Registered as `email` export in index.ts.

import PostalMime from "postal-mime";
import { generateId } from "@emailflare/email-core";
import {
	parseThreadToken,
	stripThreadToken,
	threadMessageId,
	upsertPerson,
	resolveThreadId,
} from "@emailflare/inbox-core";
import { D1Db } from "./db.ts";
import type { Env } from "./env.ts";

const LARGE_BODY_THRESHOLD = 512 * 1024; // 512 KB

export async function handleIncomingEmail(message: ForwardableEmailMessage, env: Env): Promise<void> {
	const raw = await new Response(message.raw).arrayBuffer();
	const email = await PostalMime.parse(raw);
	const db = new D1Db(env.DB);

	const fromAddress = message.from.toLowerCase();
	const toAddress = message.to.toLowerCase();
	const now = new Date().toISOString();

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
	const threadId = await resolveThreadId(db, tokenParent ?? email.inReplyTo, { generateId });

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
