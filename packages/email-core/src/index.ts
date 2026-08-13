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
  reason: 'hard_bounce' | 'soft_bounce' | 'complaint' | 'manual';
  domain_id: string | null;
  email_log_id: string | null;
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
  variables: z.record(z.string()).optional(),
  themeId: z.string().optional(),
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
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, hyphens').optional(),
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

/**
 * Substitute `{{variableName}}` placeholders in a string with values from `vars`.
 * Unknown placeholders are left as-is.
 */
export function applyVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/**
 * Convert a display name to a URL-safe slug.
 * e.g. "Welcome Email" → "welcome-email"
 */
export function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
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

