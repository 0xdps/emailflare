import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { createLogger } from '@emailflare/email-core/logger';
import { env } from '../env.js';
import { db } from '../db.js';
import {
  parseEmail,
  isBounce,
  isComplaint,
  extractRecipient,
  classifyBounce,
  extractReason,
} from '../lib/bounce-parser.js';

const log = createLogger('webhooks');

export const webhooksRoutes = new Hono();

// ── Auth middleware ────────────────────────────────────────────────────────────

webhooksRoutes.use('/bounce', async (c, next) => {
  if (!env.WEBHOOK_SECRET) {
    return c.json({ error: 'Webhook endpoint is disabled (WEBHOOK_SECRET not set)' }, 403);
  }
  const auth = c.req.header('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : c.req.query('secret') ?? '';
  if (token !== env.WEBHOOK_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

// ── POST /api/webhooks/bounce ──────────────────────────────────────────────────
//
// Accepts an inbound RFC 5322 email (DSN or ARF) and processes it as a bounce
// or complaint notification.  Callers should POST the raw email with:
//   Content-Type: message/rfc822   (or application/octet-stream)
//   Authorization: Bearer <WEBHOOK_SECRET>
//
// Compatible setups:
//   - Postfix pipe transport → curl POST to this endpoint
//   - smtp2http / Haraka HTTP output plugin
//   - Cloudflare Email Routing → Worker → forward raw bytes to this URL
//   - Any provider that can POST raw RFC 5322 to a webhook URL

// After N soft bounces to the same address we suppress it to protect reputation.
const SOFT_BOUNCE_THRESHOLD = 3;

webhooksRoutes.post('/bounce', async (c) => {
  let rawBytes: ArrayBuffer;

  const ct = (c.req.header('Content-Type') ?? '').toLowerCase();

  if (ct.startsWith('multipart/form-data')) {
    // Some forwarders POST as form-data with the email in a field
    const form = await c.req.formData();
    const field = form.get('email') ?? form.get('raw') ?? form.get('message');
    if (!field || typeof field !== 'string') {
      return c.json({ error: 'Expected form field "email" with raw message' }, 400);
    }
    const enc = new TextEncoder();
    rawBytes = enc.encode(field).buffer as ArrayBuffer;
  } else {
    // Raw RFC 5322 body
    rawBytes = await c.req.arrayBuffer();
  }

  if (!rawBytes || rawBytes.byteLength === 0) {
    return c.json({ error: 'Empty body' }, 400);
  }

  let email: Awaited<ReturnType<typeof parseEmail>>;
  try {
    email = await parseEmail(rawBytes);
  } catch {
    return c.json({ error: 'Failed to parse email' }, 422);
  }

  const content = `${email.text ?? ''}\n${email.html ?? ''}`;

  if (isComplaint(email)) {
    const recipient = extractRecipient(content);
    if (!recipient) {
      log.warn('complaint: could not extract recipient');
      return c.json({ ok: true, action: 'skipped', reason: 'no_recipient' });
    }

    // Update the most recent sent email to this address within 30 days
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const existing = await db.query(
      `SELECT id FROM email_logs
        WHERE to_address = ? AND status = 'sent' AND sent_at >= ?
        ORDER BY sent_at DESC LIMIT 1`,
      [recipient, cutoff],
    );

    const now = new Date().toISOString();
    if (existing.rows.length > 0) {
      await db.exec(
        `UPDATE email_logs SET status = 'complained', bounced_at = ? WHERE id = ?`,
        [now, (existing.rows[0] as { id: string }).id],
      );
    }

    // Always suppress on complaint
    await db.exec(
      `INSERT OR IGNORE INTO suppressions (id, email, reason, domain_id, email_log_id, created_at)
       VALUES (?, ?, 'complaint', NULL, ?, ?)`,
      [
        nanoid(),
        recipient,
        (existing.rows[0] as { id: string } | undefined)?.id ?? null,
        now,
      ],
    );

    return c.json({ ok: true, action: 'complaint', recipient });
  }

  if (isBounce(email)) {
    const recipient = extractRecipient(content);
    if (!recipient) {
      log.warn('bounce: could not extract recipient');
      return c.json({ ok: true, action: 'skipped', reason: 'no_recipient' });
    }

    const bounceType = classifyBounce(content);
    const reason     = extractReason(content);

    // Update the most recent sent email to this address within 7 days
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const existing = await db.query(
      `SELECT id FROM email_logs
        WHERE to_address = ? AND status = 'sent' AND sent_at >= ?
        ORDER BY sent_at DESC LIMIT 1`,
      [recipient, cutoff],
    );

    const now = new Date().toISOString();
    const logId = (existing.rows[0] as { id: string } | undefined)?.id ?? null;

    if (logId) {
      await db.exec(
        `UPDATE email_logs SET status = 'bounced', error = ?, bounced_at = ? WHERE id = ?`,
        [reason, now, logId],
      );
    }

    if (bounceType === 'hard') {
      // Permanent address failure — suppress immediately
      await db.exec(
        `INSERT OR IGNORE INTO suppressions (id, email, reason, domain_id, email_log_id, created_at)
         VALUES (?, ?, 'hard_bounce', NULL, ?, ?)`,
        [nanoid(), recipient, logId, now],
      );
      return c.json({ ok: true, action: 'bounce_hard', recipient });
    }

    if (bounceType === 'spam_rejection') {
      // Receiving server permanently refused as spam/policy — treat like a hard bounce
      // so we stop sending and protect our sending reputation.
      await db.exec(
        `INSERT OR IGNORE INTO suppressions (id, email, reason, domain_id, email_log_id, created_at)
         VALUES (?, ?, 'hard_bounce', NULL, ?, ?)`,
        [nanoid(), recipient, logId, now],
      );
      return c.json({ ok: true, action: 'bounce_spam_rejection', recipient });
    }

    // Soft bounce — temporary failure. Suppress only after repeated failures to
    // avoid repeatedly hitting a degraded or full mailbox.
    const bounceCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const bounceCount = await db.query(
      `SELECT COUNT(*) AS cnt FROM email_logs
        WHERE to_address = ? AND status = 'bounced' AND sent_at >= ?`,
      [recipient, bounceCutoff],
    );
    const cnt = Number((bounceCount.rows[0] as { cnt: number }).cnt);

    if (cnt >= SOFT_BOUNCE_THRESHOLD) {
      await db.exec(
        `INSERT OR IGNORE INTO suppressions (id, email, reason, domain_id, email_log_id, created_at)
         VALUES (?, ?, 'soft_bounce', NULL, ?, ?)`,
        [nanoid(), recipient, logId, now],
      );
      return c.json({ ok: true, action: 'bounce_soft_suppressed', recipient, softBounceCount: cnt });
    }

    return c.json({ ok: true, action: 'bounce_soft', recipient, softBounceCount: cnt, threshold: SOFT_BOUNCE_THRESHOLD });
  }

  return c.json({ ok: true, action: 'skipped', reason: 'not_a_bounce_or_complaint' });
});
