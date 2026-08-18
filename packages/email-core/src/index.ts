/**
 * @emailflare/email-core
 *
 * Shared types, Zod validation schemas, and pure helpers used by both:
 *   - services/email-worker  (Cloudflare Worker — D1, KV)
 *   - services/email-server  (Node.js — MesaHub)
 *
 * Rules for this package:
 *   - NO runtime-specific code (no D1, no MesaHub, no Node.js APIs, no Web Crypto)
 *   - Only types, Zod schemas, and pure functions (no side effects)
 */

import { z } from 'zod';
import { customAlphabet } from 'nanoid';
import Handlebars from 'handlebars';

// ── Row interfaces ─────────────────────────────────────────────────────────────
// SQLite columns use INTEGER for booleans (0 | 1) and TEXT for dates (ISO 8601).

export interface DomainRow {
  [key: string]: unknown;
  id: string;
  name: string;
  cf_zone_id: string;
  cf_subdomain_id: string | null;
  dkim_selector: string | null;
  return_path_domain: string | null;
  verified: number; // 0 | 1
  created_at: string;
}

export interface TemplateRow {
  [key: string]: unknown;
  id: string;
  name: string;
  slug: string | null;
  subject: string;
  html_body: string;
  text_body: string | null;
  layout: string | null;
  is_system: number; // 0 | 1
  domain_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyRow {
  [key: string]: unknown;
  id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  scope: 'global' | 'domain' | 'multi';
  key_type: 'test' | 'live';
  active: number; // 0 | 1
  last_used_at: string | null;
  send_count: number;
  created_at: string;
}

export interface ApiKeyDomainRow {
  [key: string]: unknown;
  api_key_id: string;
  domain_id: string;
}

export interface EmailLogRow {
  [key: string]: unknown;
  id: string;
  to_address: string;
  from_address: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced' | 'complained';
  cf_message_id: string | null;
  domain_id: string | null;
  template_id: string | null;
  api_key_id: string | null;
  idempotency_key: string | null;
  error: string | null;
  is_test: number; // 0 | 1
  html_body?: string | null;
  text_body?: string | null;
  sent_at: string;
  bounced_at?: string | null;
}

export interface SuppressionRow {
  [key: string]: unknown;
  id: string;
  email: string;
  reason: 'hard_bounce' | 'soft_bounce' | 'complaint' | 'manual' | 'unsubscribed';
  domain_id: string | null;
  email_log_id: string | null;
  list_id?: string | null;
  created_at: string;
}

export interface ListRow {
  [key: string]: unknown;
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  domain_id: string | null;
  created_at: string;
}

export interface UnsubscribeTokenRow {
  [key: string]: unknown;
  token: string;
  email: string;
  list_id: string | null;
  created_at: string;
}

// ── Zod schemas ────────────────────────────────────────────────────────────────

/**
 * POST /v1/send — transactional email send payload.
 * Identical between email-server and email-worker.
 */
export const sendSchema = z.object({
  from: z.string().email(),
  fromName: z.string().optional(),
  to: z.union([z.string().email(), z.array(z.string().email()).max(50)]),
  replyTo: z.string().email().optional(),
  subject: z.string().min(1).optional(),
  html: z.string().optional(),
  text: z.string().optional(),
  templateId: z.string().optional(),
  templateSlug: z.string().optional(),
  variables: z.record(z.unknown()).optional(),
  themeId: z.string().optional(),
  // List management / unsubscribe
  listId: z.string().optional(),
  listUnsubscribe: z.string().optional(),
  listUnsubscribePost: z.boolean().optional(),
}).refine(d => d.templateId || d.templateSlug || d.html || d.text, {
  message: 'Provide templateId, templateSlug, or at least one of html/text',
});

export type SendInput = z.infer<typeof sendSchema>;

/** POST /api/domains — create a sending domain. */
export const domainCreateSchema = z.object({
  name: z.string().min(3),
  cfZoneId: z.string().optional(),
});

export type DomainCreateInput = z.infer<typeof domainCreateSchema>;

/** POST /api/templates — create or update an email template. */
export const templateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, hyphens'),
  subject: z.string().min(1),
  htmlBody: z.string().min(1),
  textBody: z.string().optional(),
  domainId: z.string().optional().nullable(),
});

export type TemplateInput = z.infer<typeof templateSchema>;

/** POST /api/keys — create an API key. */
export const keyCreateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['test', 'live']).default('live'),
  scope: z.enum(['global', 'domain', 'multi']).default('global'),
  domainIds: z.array(z.string()).optional(),
});

export type KeyCreateInput = z.infer<typeof keyCreateSchema>;

/** POST /api/lists — create a list (audience). */
export const listCreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, hyphens').optional(),
  description: z.string().optional(),
  domainId: z.string().optional().nullable(),
});

export type ListCreateInput = z.infer<typeof listCreateSchema>;

/**
 * POST /api/auth/login — admin token login (email-server / email-worker).
 * Uses a static admin token, not email+password.
 */
export const adminLoginSchema = z.object({
  token: z.string().min(1),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

// ── Pure helpers ───────────────────────────────────────────────────────────────

/**
 * Generate a collision-resistant 21-character alphanumeric ID.
 * Consistent alphabet and length used across the entire codebase.
 * Safe in both Cloudflare Workers and Node.js.
 */
export const generateId = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  21,
);

/** Short collision-suffix id (e.g. for slug disambiguation). */
export function shortId(n = 4): string {
  return generateId().slice(0, n);
}

/**
 * Render a Handlebars template string with the given variables.
 *
 * Supports the full Handlebars feature set: `{{name}}`, `{{#each items}}`,
 * `{{#if condition}}`, helpers, and more. Missing variables render as an empty
 * string (Handlebars default), so a variable omitted from `vars` is dropped
 * rather than left as a literal `{{token}}`.
 *
 * ⚠️ Templates authored against the old `{{variable}}`-only syntax remain
 * fully compatible — plain `{{name}}` interpolation behaves identically.
 */
export function applyVariables(template: string, vars: Record<string, unknown>): string {
  return Handlebars.compile(template, { noEscape: true })(vars);
}

/**
 * Convert a display name to a URL-safe slug.
 * e.g. "Welcome Email" → "welcome-email"
 */
export function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Build RFC 8058 List-Unsubscribe headers for a one-time token.
 * `origin` is the public base URL of the API (e.g. https://app.example.com).
 * When `post` is true, adds List-Unsubscribe-Post for one-click unsubscribe.
 */
export function listUnsubscribeHeaders(
  origin: string,
  token: string,
  post: boolean,
): Record<string, string> {
  const url = `${origin.replace(/\/$/, '')}/v1/unsubscribe?token=${encodeURIComponent(token)}`;
  const headers: Record<string, string> = { 'List-Unsubscribe': `<${url}>` };
  if (post) headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  return headers;
}

// ── sendWithLog — shared "deliver + record" orchestration ────────────────────
//
// The single seam both the transactional API (`/v1/send`) and the inbox compose
// flow use to actually deliver an email and write the `email_logs` row that
// powers the Logs page + Dashboard. Delivery and persistence are injected so
// this stays runtime-agnostic (works for D1 and MesaHub, live and test sends).

export interface SendWithLogMessage {
  from: string | { address: string; name: string };
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface SendWithLogOptions {
  /** Deliver the email (live CF send, or test capture). Returns the CF message id. */
  deliver: (msg: SendWithLogMessage) => Promise<{ id: string }>;
  /** Resolve the domain_id for a sender address (null if unknown). */
  resolveDomainId: (fromAddress: string) => Promise<string | null>;
  /** Persist an email_logs row. */
  insertLog: (row: EmailLogRow) => Promise<unknown>;
  /** Extra metadata attached to the log row. */
  templateId?: string | null;
  apiKeyId?: string | null;
  idempotencyKey?: string | null;
  isTest?: boolean;
  /** Store html/text bodies in the log (used by the in-house test mailbox). */
  storeBodies?: boolean;
}

export interface SendWithLogResult {
  cfId?: string;
  error?: string;
}

export async function sendWithLog(
  opts: SendWithLogOptions,
  msg: SendWithLogMessage,
): Promise<SendWithLogResult> {
  const fromAddress = typeof msg.from === 'string' ? msg.from : msg.from.address;
  const now         = new Date().toISOString();
  const domainId    = await opts.resolveDomainId(fromAddress);
  const isTest      = opts.isTest ? 1 : 0;

  try {
    const result = await opts.deliver(msg);
    await opts.insertLog({
      id: generateId(),
      to_address: msg.to,
      from_address: fromAddress,
      subject: msg.subject,
      status: 'sent',
      cf_message_id: result.id ?? null,
      domain_id: domainId,
      template_id: opts.templateId ?? null,
      api_key_id: opts.apiKeyId ?? null,
      idempotency_key: opts.idempotencyKey ?? null,
      error: null,
      is_test: isTest,
      html_body: opts.storeBodies ? (msg.html ?? null) : null,
      text_body: opts.storeBodies ? (msg.text ?? null) : null,
      sent_at: now,
    });
    return { cfId: result.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await opts.insertLog({
      id: generateId(),
      to_address: msg.to,
      from_address: fromAddress,
      subject: msg.subject,
      status: 'failed',
      cf_message_id: null,
      domain_id: domainId,
      template_id: opts.templateId ?? null,
      api_key_id: opts.apiKeyId ?? null,
      idempotency_key: null,
      error: message,
      is_test: isTest,
      html_body: opts.storeBodies ? (msg.html ?? null) : null,
      text_body: opts.storeBodies ? (msg.text ?? null) : null,
      sent_at: now,
    });
    return { error: message };
  }
}

// ── Send-pipeline helpers (injected DB access → runtime-agnostic) ────────────

/** Minimal query handle: run SQL with params and get rows. */
export interface DbQueryHandle {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  run: (sql: string, params?: unknown[]) => Promise<unknown>;
}

/**
 * Resolve the domain id for a sender address. Matches the exact domain or a
 * subdomain (`foo@mail.example.com` → `example.com`). Returns null if unknown.
 */
export async function resolveDomainId(
  db: Pick<DbQueryHandle, 'query'>,
  fromAddress: string,
): Promise<string | null> {
  const senderDomain = fromAddress.split('@')[1];
  if (!senderDomain) return null;
  const result = await db.query(
    'SELECT id FROM domains WHERE name = ? OR name LIKE ? LIMIT 1',
    [senderDomain, `%.${senderDomain}`],
  );
  return (result.rows[0]?.id as string | undefined) ?? null;
}

/**
 * Check whether an address is suppressed. Returns the suppression reason, or
 * null if the address is safe to send to.
 */
export async function checkSuppressed(
  db: Pick<DbQueryHandle, 'query'>,
  email: string,
): Promise<string | null> {
  const result = await db.query(
    'SELECT reason FROM suppressions WHERE email = ? LIMIT 1',
    [email.toLowerCase()],
  );
  return (result.rows[0]?.reason as string | undefined) ?? null;
}

/**
 * Issue a one-time unsubscribe token and build the RFC 8058 List-Unsubscribe
 * headers. Handles both the `listId` (token-issuing) and `listUnsubscribe`
 * (pass-through URL) cases. Returns undefined if no unsubscribe headers apply.
 */
export async function issueUnsubscribeToken(
  db: Pick<DbQueryHandle, 'run'>,
  opts: {
    publicOrigin: string;
    email: string;
    listId?: string;
    listUnsubscribe?: string;
    listUnsubscribePost?: boolean;
    generateToken: () => string;
  },
): Promise<Record<string, string> | undefined> {
  if (opts.listId && opts.publicOrigin) {
    const token = opts.generateToken();
    await db.run(
      'INSERT INTO unsubscribe_tokens (token, email, list_id, created_at) VALUES (?, ?, ?, ?)',
      [token, opts.email.toLowerCase(), opts.listId, new Date().toISOString()],
    );
    return listUnsubscribeHeaders(opts.publicOrigin, token, opts.listUnsubscribePost ?? true);
  }
  if (opts.listUnsubscribe) {
    const headers: Record<string, string> = { 'List-Unsubscribe': opts.listUnsubscribe };
    if (opts.listUnsubscribePost) headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    return headers;
  }
  return undefined;
}

/**
 * Enrich a template row with a computed `variables` array, derived from
 * the layout registry. Pass the `LAYOUTS` map from `@emailflare/emails`.
 *
 * @example
 * import { LAYOUTS } from '@emailflare/emails';
 * import { enrich } from '@emailflare/email-core';
 * const rows = await templates.find();
 * return c.json(rows.map(r => enrich(r, LAYOUTS)));
 */
export function enrich(
  row: TemplateRow,
  layouts: Record<string, { variables?: string[] }>,
): TemplateRow & { variables: string[] } {
  const variables: string[] = row.is_system && row.layout
    ? (layouts[row.layout]?.variables ?? [])
    : [];
  return { ...row, variables };
}

