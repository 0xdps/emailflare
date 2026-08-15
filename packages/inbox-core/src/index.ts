/**
 * @emailflare/inbox-core
 *
 * Shared types, Zod validation schemas, and pure helpers used by both:
 *   - services/inbox-worker  (Cloudflare Worker — D1, R2, KV, DO, Queues)
 *   - services/inbox-server  (Node.js — MesaHub, Redis)
 *
 * Rules for this package:
 *   - NO runtime-specific code (no D1, no MesaHub, no Node.js APIs, no Web Crypto)
 *   - Only types, Zod schemas, and pure functions (no side effects)
 */

import { z } from 'zod';

// ── Row interfaces ─────────────────────────────────────────────────────────────
// SQLite columns use INTEGER for booleans (0 | 1) and TEXT for dates (ISO 8601).

export interface UserRow {
  [key: string]: unknown;
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: 'super-admin' | 'admin' | 'member' | 'tester';
  created_at: string;
}

export interface InviteRow {
  [key: string]: unknown;
  id: string;
  email: string;
  token_hash: string;
  created_by: string;
  role: 'admin' | 'member' | 'tester';
  expires_at: string;
  used: number; // 0 | 1
  created_at: string;
}

export interface PersonRow {
  [key: string]: unknown;
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}

export interface InboxRow {
  [key: string]: unknown;
  id: string;
  email: string;
  display_name: string;
  mode: 'thread' | 'individual';
  created_at: string;
}

export interface InboxMemberRow {
  [key: string]: unknown;
  inbox_id: string;
  user_id: string;
}

export interface InboxEmailRow {
  [key: string]: unknown;
  id: string;
  person_id: string;
  inbox_address: string;
  subject: string;
  body_html: string | null;
  body_text: string | null;
  body_r2_key: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  spf: string | null;
  dkim: string | null;
  dmarc: string | null;
  is_read: number; // 0 | 1
  received_at: string;
}

export interface SentInboxEmailRow {
  [key: string]: unknown;
  id: string;
  person_id: string | null;
  in_reply_to: string | null;
  from_address: string;
  to_address: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed';
  cf_message_id: string | null;
  sent_at: string;
}

export interface AttachmentRow {
  [key: string]: unknown;
  id: string;
  email_id: string;
  filename: string;
  content_type: string;
  r2_key: string;
  size: number;
  created_at: string;
}

export interface InboxTemplateRow {
  [key: string]: unknown;
  id: string;
  slug: string;
  subject: string;
  body_html: string;
  created_at: string;
  updated_at: string;
}

export interface SequenceRow {
  [key: string]: unknown;
  id: string;
  name: string;
  steps: string; // JSON array of SequenceStep
  created_at: string;
  updated_at: string;
}

export interface SequenceEnrollmentRow {
  [key: string]: unknown;
  id: string;
  sequence_id: string;
  person_id: string;
  from_address: string;
  variables: string; // JSON object
  current_step: number;
  status: 'active' | 'completed' | 'cancelled';
  enrolled_at: string;
}

export interface PushSubscriptionRow {
  [key: string]: unknown;
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

// ── Payload interfaces ─────────────────────────────────────────────────────────

/**
 * Inbound email payload forwarded from inbox-bridge (CF Worker) to inbox-server
 * via the /webhook/email endpoint, signed with HMAC-SHA256.
 */
export interface EmailPayload {
  from: string;
  to: string;
  rawBase64: string;   // base64-encoded raw RFC 5322 message bytes
  spf?: string | null;
  dkim?: string | null;
  dmarc?: string | null;
}

// ── Zod schemas ────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login — email+password login (inbox-server / inbox-worker).
 * Distinct from email-core's adminLoginSchema which uses a static token.
 */
export const userLoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export type UserLoginInput = z.infer<typeof userLoginSchema>;

/** POST /api/inbox/inboxes — create or update an inbox email address. */
export const inboxSchema = z.object({
  email: z.string().email().toLowerCase(),
  display_name: z.string().min(1).max(100),
  mode: z.enum(['thread', 'individual']).default('thread'),
});

export type InboxInput = z.infer<typeof inboxSchema>;

/** A single step in an email sequence. */
export const sequenceStepSchema = z.object({
  delay_days: z.number().int().min(0),
  subject: z.string().min(1),
  html: z.string().optional(),
  text: z.string().optional(),
});

export type SequenceStep = z.infer<typeof sequenceStepSchema>;

/** POST /api/inbox/sequences — create or update a sequence. */
export const sequenceSchema = z.object({
  name: z.string().min(1).max(200),
  steps: z.array(sequenceStepSchema).min(1),
});

export type SequenceInput = z.infer<typeof sequenceSchema>;

/** POST /api/inbox/inbox-templates — create or update a reusable reply template. */
export const inboxTemplateSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  subject: z.string().min(1),
  body_html: z.string().min(1),
});

export type InboxTemplateInput = z.infer<typeof inboxTemplateSchema>;

/** POST /api/inbox/compose — compose and send a new outbound email. */
export const composeSchema = z.object({
  to: z.string().email(),
  from: z.string().email(),
  fromName: z.string().optional(),
  subject: z.string().min(1),
  html: z.string().optional(),
  text: z.string().optional(),
  inReplyTo: z.string().optional(),
  personId: z.string().optional(),
});

export type ComposeInput = z.infer<typeof composeSchema>;

// ── Pure helpers ───────────────────────────────────────────────────────────────

/**
 * Parse a "Name <email@example.com>" string into its components.
 * Falls back gracefully if the string is already a plain email address.
 *
 * @example
 * parseEmailAddress('Alice <alice@example.com>')
 * // → { name: 'Alice', email: 'alice@example.com' }
 * parseEmailAddress('bob@example.com')
 * // → { name: null, email: 'bob@example.com' }
 */
export function parseEmailAddress(str: string): { name: string | null; email: string } {
  const match = str.trim().match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim().replace(/^["']|["']$/g, '') || null, email: match[2].trim().toLowerCase() };
  }
  return { name: null, email: str.trim().toLowerCase() };
}

/**
 * Strip HTML tags and collapse whitespace to produce a plain-text preview.
 * Suitable for building search indexes or email snippets — not for full rendering.
 */
export function extractPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

