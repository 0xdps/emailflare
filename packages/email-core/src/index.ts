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

import { z } from "zod";
import { customAlphabet } from "nanoid";

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
	scope: "global" | "domain" | "multi";
	key_type: "test" | "live";
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
	status: "pending" | "sent" | "failed" | "bounced" | "complained";
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
	reason: "hard_bounce" | "soft_bounce" | "complaint" | "manual" | "unsubscribed";
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
export const sendSchema = z
	.object({
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
	})
	.refine((d) => d.templateId || d.templateSlug || d.html || d.text, {
		message: "Provide templateId, templateSlug, or at least one of html/text",
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
	slug: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, hyphens"),
	subject: z.string().min(1),
	htmlBody: z.string().min(1),
	textBody: z.string().optional(),
	domainId: z.string().optional().nullable(),
});

export type TemplateInput = z.infer<typeof templateSchema>;

/** POST /api/keys — create an API key. */
export const keyCreateSchema = z.object({
	name: z.string().min(1),
	type: z.enum(["test", "live"]).default("live"),
	scope: z.enum(["global", "domain", "multi"]).default("global"),
	domainIds: z.array(z.string()).optional(),
});

export type KeyCreateInput = z.infer<typeof keyCreateSchema>;

/** POST /api/lists — create a list (audience). */
export const listCreateSchema = z.object({
	name: z.string().min(1),
	slug: z
		.string()
		.regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, hyphens")
		.optional(),
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
export const generateId = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 21);

/** Short collision-suffix id (e.g. for slug disambiguation). */
export function shortId(n = 4): string {
	return generateId().slice(0, n);
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface Pagination {
	page: number;
	limit: number;
	offset: number;
}

/**
 * Parse `?page=&limit=` query params into clamped, always-valid pagination.
 *
 * - non-numeric or missing values fall back to the defaults
 * - `page` is clamped to >= 1
 * - `limit` is clamped to 1..maxLimit (SQLite treats LIMIT 0/negative as
 *   "no limit", which would let `?limit=-1` dump an entire table)
 */
export function parsePagination(
	query: { page?: string; limit?: string },
	opts: { defaultLimit?: number; maxLimit?: number } = {},
): Pagination {
	const defaultLimit = opts.defaultLimit ?? 50;
	const maxLimit = opts.maxLimit ?? 100;

	const rawPage = parseInt(query.page ?? "", 10);
	const rawLimit = parseInt(query.limit ?? "", 10);

	const page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
	const limit = Number.isFinite(rawLimit) ? Math.min(maxLimit, Math.max(1, rawLimit)) : defaultLimit;

	return { page, limit, offset: (page - 1) * limit };
}

// ── CSP-safe Handlebars-compatible template renderer ──────────────────────
//
// Cloudflare Workers block `new Function()` / `eval()` (CSP), so Handlebars
// (which compiles templates to JS functions) cannot run. This renderer
// interprets a subset of Handlebars syntax at runtime without code generation.
//
// Supported syntax:
//   {{var}}              simple interpolation
//   {{obj.prop}}         nested path access
//   {{#each items}}...{{/each}}   loop ({{this}}, {{@index}}, {{@key}})
//   {{#if cond}}...{{else}}...{{/if}}   conditional (truthy/falsy)
//   {{#unless cond}}...{{/unless}}      inverse conditional
//   {{#with obj}}...{{/with}}           scope block
//
// Missing variables render as empty string (Handlebars default).

type HbsContext = Record<string, unknown>;

function hbsGet(ctx: HbsContext, path: string): unknown {
	const parts = path.split(".");
	let val: unknown = ctx;
	for (const part of parts) {
		if (val == null) return undefined;
		if (typeof val === "object") {
			val = (val as Record<string, unknown>)[part];
		} else {
			return undefined;
		}
	}
	return val;
}

function hbsTruthy(v: unknown): boolean {
	if (v == null) return false;
	if (typeof v === "boolean") return v;
	if (typeof v === "number") return v !== 0;
	if (typeof v === "string") return v.length > 0;
	if (Array.isArray(v)) return v.length > 0;
	return true;
}

function hbsRender(template: string, ctx: HbsContext): string {
	// Tokenize: {{...}} blocks vs literal text
	const tokens: Array<
		{ type: "text"; value: string } | { type: "open"; raw: string } | { type: "close"; raw: string }
	> = [];
	let i = 0;
	while (i < template.length) {
		const open = template.indexOf("{{", i);
		if (open === -1) {
			tokens.push({ type: "text", value: template.slice(i) });
			break;
		}
		if (open > i) {
			tokens.push({ type: "text", value: template.slice(i, open) });
		}
		const close = template.indexOf("}}", open + 2);
		if (close === -1) {
			tokens.push({ type: "text", value: template.slice(open) });
			break;
		}
		const raw = template.slice(open + 2, close).trim();
		if (raw.startsWith("/")) {
			tokens.push({ type: "close", raw: raw.slice(1).trim() });
		} else {
			tokens.push({ type: "open", raw });
		}
		i = close + 2;
	}

	// Walk tokens, building output
	let out = "";
	let pos = 0;

	function walk(endBlock?: string): string {
		let result = "";
		while (pos < tokens.length) {
			const t = tokens[pos];
			if (t.type === "text") {
				result += t.value;
				pos++;
			} else if (t.type === "close") {
				if (endBlock !== undefined && t.raw === endBlock) {
					pos++;
					return result;
				}
				// Unmatched close — treat as literal
				result += `{{/${t.raw}}}`;
				pos++;
			} else {
				// open token
				const expr = t.raw;

				// {{#each items}} or {{#each items as |val key|}}
				const eachMatch = expr.match(/^#each\s+(\S+)(?:\s+as\s+\|(\w+)(?:\s+(\w+))?\|)?$/);
				if (eachMatch) {
					const listPath = eachMatch[1];
					const valName = eachMatch[2] ?? undefined;
					const keyName = eachMatch[3] ?? undefined;
					pos++; // consume open
					const list = hbsGet(ctx, listPath);
					if (Array.isArray(list)) {
						for (let idx = 0; idx < list.length; idx++) {
							const item = list[idx];
							const loopCtx: HbsContext = { ...ctx };
							if (valName) {
								loopCtx[valName] = item;
							} else {
								// bare {{#each}} — push item as `this`
								loopCtx["this"] = item;
							}
							loopCtx["@index"] = idx;
							loopCtx["@key"] = idx;
							result += walk("each");
						}
					} else if (list != null && typeof list === "object") {
						const entries = Object.entries(list as Record<string, unknown>);
						for (let idx = 0; idx < entries.length; idx++) {
							const [k, v] = entries[idx];
							const loopCtx: HbsContext = { ...ctx };
							if (valName) {
								loopCtx[valName] = v;
							} else {
								loopCtx["this"] = v;
							}
							loopCtx["@index"] = idx;
							loopCtx["@key"] = k;
							result += walk("each");
						}
					} else {
						// falsy/empty — skip body
						walk("each");
					}
					continue;
				}

				// {{#if condition}}
				const ifMatch = expr.match(/^#if\s+(.+)$/);
				if (ifMatch) {
					const cond = hbsGet(ctx, ifMatch[1].trim());
					pos++; // consume open
					if (hbsTruthy(cond)) {
						result += walk("if");
					} else {
						// skip if body, check for else
						const saved = pos;
						let foundElse = false;
						while (pos < tokens.length) {
							const nt = tokens[pos];
							if (nt.type === "close" && nt.raw === "if") {
								pos++;
								break;
							}
							if (nt.type === "open" && nt.raw === "else") {
								pos++;
								foundElse = true;
								break;
							}
							pos++;
						}
						if (foundElse) {
							result += walk("if");
						}
					}
					continue;
				}

				// {{#unless condition}}
				const unlessMatch = expr.match(/^#unless\s+(.+)$/);
				if (unlessMatch) {
					const cond = hbsGet(ctx, unlessMatch[1].trim());
					pos++;
					if (!hbsTruthy(cond)) {
						result += walk("unless");
					} else {
						walk("unless");
					}
					continue;
				}

				// {{#with obj}}
				const withMatch = expr.match(/^#with\s+(.+)$/);
				if (withMatch) {
					const scoped = hbsGet(ctx, withMatch[1].trim());
					pos++;
					if (scoped != null && typeof scoped === "object") {
						result += walk("with");
					} else {
						walk("with");
					}
					continue;
				}

				// {{else}}
				if (expr === "else") {
					// handled by #if above — return to caller
					return result;
				}

				// Simple interpolation: {{var}} or {{this}} or {{@index}}
				pos++;
				if (expr === "this" || expr === ".") {
					const v = ctx["this"];
					result += v != null ? String(v) : "";
				} else if (expr.startsWith("@")) {
					const v = ctx[expr];
					result += v != null ? String(v) : "";
				} else {
					const v = hbsGet(ctx, expr);
					result += v != null ? String(v) : "";
				}
			}
		}
		return result;
	}

	return walk();
}

/**
 * Render a Handlebars-compatible template string with the given variables.
 *
 * Supports: `{{name}}`, `{{obj.prop}}`, `{{#each items}}`, `{{#if cond}}`,
 * `{{#unless cond}}`, `{{#with obj}}`, `{{else}}`, `{{this}}`, `{{@index}}`,
 * `{{@key}}`. Missing variables render as empty string.
 *
 * ⚠️ This is a CSP-safe interpreter — no `new Function()` or `eval()`.
 * Cloudflare Workers block dynamic code generation, so Handlebars itself
 * cannot run. This renderer covers the documented template syntax.
 */
export function applyVariables(template: string, vars: Record<string, unknown>): string {
	return hbsRender(template, vars);
}

/**
 * Convert a display name to a URL-safe slug.
 * e.g. "Welcome Email" → "welcome-email"
 */
export function toSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Build RFC 8058 List-Unsubscribe headers for a one-time token.
 * `origin` is the public base URL of the API (e.g. https://app.example.com).
 * When `post` is true, adds List-Unsubscribe-Post for one-click unsubscribe.
 */
export function listUnsubscribeHeaders(origin: string, token: string, post: boolean): Record<string, string> {
	const url = `${origin.replace(/\/$/, "")}/v1/unsubscribe?token=${encodeURIComponent(token)}`;
	const headers: Record<string, string> = { "List-Unsubscribe": `<${url}>` };
	if (post) headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
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

export async function sendWithLog(opts: SendWithLogOptions, msg: SendWithLogMessage): Promise<SendWithLogResult> {
	const fromAddress = typeof msg.from === "string" ? msg.from : msg.from.address;
	const now = new Date().toISOString();
	const domainId = await opts.resolveDomainId(fromAddress);
	const isTest = opts.isTest ? 1 : 0;

	try {
		const result = await opts.deliver(msg);
		await opts.insertLog({
			id: generateId(),
			to_address: msg.to,
			from_address: fromAddress,
			subject: msg.subject,
			status: "sent",
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
		const message = err instanceof Error ? err.message : "Unknown error";
		await opts.insertLog({
			id: generateId(),
			to_address: msg.to,
			from_address: fromAddress,
			subject: msg.subject,
			status: "failed",
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
export async function resolveDomainId(db: Pick<DbQueryHandle, "query">, fromAddress: string): Promise<string | null> {
	const senderDomain = fromAddress.split("@")[1];
	if (!senderDomain) return null;
	const result = await db.query("SELECT id FROM domains WHERE name = ? OR name LIKE ? LIMIT 1", [
		senderDomain,
		`%.${senderDomain}`,
	]);
	return (result.rows[0]?.id as string | undefined) ?? null;
}

/**
 * Check whether an address is suppressed. Returns the suppression reason, or
 * null if the address is safe to send to.
 */
export async function checkSuppressed(db: Pick<DbQueryHandle, "query">, email: string): Promise<string | null> {
	const result = await db.query("SELECT reason FROM suppressions WHERE email = ? LIMIT 1", [email.toLowerCase()]);
	return (result.rows[0]?.reason as string | undefined) ?? null;
}

/**
 * Issue a one-time unsubscribe token and build the RFC 8058 List-Unsubscribe
 * headers. Handles both the `listId` (token-issuing) and `listUnsubscribe`
 * (pass-through URL) cases. Returns undefined if no unsubscribe headers apply.
 */
export async function issueUnsubscribeToken(
	db: Pick<DbQueryHandle, "run">,
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
		await db.run("INSERT INTO unsubscribe_tokens (token, email, list_id, created_at) VALUES (?, ?, ?, ?)", [
			token,
			opts.email.toLowerCase(),
			opts.listId,
			new Date().toISOString(),
		]);
		return listUnsubscribeHeaders(opts.publicOrigin, token, opts.listUnsubscribePost ?? true);
	}
	if (opts.listUnsubscribe) {
		const headers: Record<string, string> = { "List-Unsubscribe": opts.listUnsubscribe };
		if (opts.listUnsubscribePost) headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
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
	const variables: string[] = row.is_system && row.layout ? (layouts[row.layout]?.variables ?? []) : [];
	return { ...row, variables };
}
