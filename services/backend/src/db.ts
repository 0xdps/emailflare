import { MesahubClient } from '@mesahub/client';
import { customAlphabet } from 'nanoid';
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 21);
import { env } from './env.js';
import { parseMesahubUrl } from './lib/mesahub-url.js';
import { LAYOUTS } from '@emailflare/emails';
import type { LayoutName } from '@emailflare/emails';

const { apiUrl, apiKey, dbName } = parseMesahubUrl(env.MESAHUB_URL);
const client = new MesahubClient({ apiKey, apiUrl, routePrefix: 'api' });
export const db = client.db(dbName);

// ── Table handles ─────────────────────────────────────────────────────────────

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
  status: 'pending' | 'sent' | 'failed';
  cf_message_id: string | null;
  domain_id: string | null;
  template_id: string | null;
  api_key_id: string | null;
  idempotency_key: string | null;
  error: string | null;
  is_test: number; // 0 | 1
  html_body: string | null;
  text_body: string | null;
  sent_at: string;
}

export const domains    = db.table<DomainRow>('domains');
export const templates  = db.table<TemplateRow>('templates');
export const apiKeys    = db.table<ApiKeyRow>('api_keys');
export const apiKeyDomains = db.table<ApiKeyDomainRow>('api_key_domains');
export const emailLogs  = db.table<EmailLogRow>('email_logs');

/** Delete a domain and cascade-remove its api_key_domains associations. */
export async function deleteDomainCascade(domainId: string): Promise<void> {
  await apiKeyDomains.delete({ where: { domain_id: domainId } });
  await domains.delete({ where: { id: domainId } });
}

// ── Schema bootstrap ──────────────────────────────────────────────────────────

export async function bootstrapSchema(): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS domains (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL UNIQUE,
      cf_zone_id       TEXT NOT NULL,
      cf_subdomain_id  TEXT,
      dkim_selector    TEXT,
      return_path_domain TEXT,
      verified         INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT NOT NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      slug        TEXT UNIQUE,
      subject     TEXT NOT NULL,
      html_body   TEXT NOT NULL DEFAULT '',
      text_body   TEXT,
      layout      TEXT,
      is_system   INTEGER NOT NULL DEFAULT 0,
      domain_id   TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    )
  `);


  await db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      key_hash     TEXT NOT NULL UNIQUE,
      key_prefix   TEXT NOT NULL,
      scope        TEXT NOT NULL DEFAULT 'global',
      key_type     TEXT NOT NULL DEFAULT 'live',
      active       INTEGER NOT NULL DEFAULT 1,
      last_used_at TEXT,
      send_count   INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS api_key_domains (
      api_key_id  TEXT NOT NULL,
      domain_id   TEXT NOT NULL,
      PRIMARY KEY (api_key_id, domain_id)
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id               TEXT PRIMARY KEY,
      to_address       TEXT NOT NULL,
      from_address     TEXT NOT NULL,
      subject          TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'pending',
      cf_message_id    TEXT,
      domain_id        TEXT,
      template_id      TEXT,
      api_key_id       TEXT,
      idempotency_key  TEXT,
      error            TEXT,
      is_test          INTEGER NOT NULL DEFAULT 0,
      html_body        TEXT,
      text_body        TEXT,
      sent_at          TEXT NOT NULL
    )
  `);

  // Indices
  try { await db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_sent_at   ON email_logs(sent_at)`); } catch { /* ignore */ }
  try { await db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_status    ON email_logs(status)`); } catch { /* ignore */ }
  try { await db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_api_key   ON email_logs(api_key_id)`); } catch { /* ignore */ }
  try { await db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_domain    ON email_logs(domain_id)`); } catch { /* ignore */ }
  try { await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_logs_idempotency ON email_logs(idempotency_key) WHERE idempotency_key IS NOT NULL`); } catch { /* ignore */ }

  if (process.env.NODE_ENV !== 'production') console.log('[db] schema bootstrapped');
}

// ── System template subjects ──────────────────────────────────────────────────

const SYSTEM_SUBJECTS: Record<LayoutName, string> = {
  'welcome':                'Welcome to {{appName}}, {{name}}!',
  'magic-link':             'Your sign-in link for {{appName}}',
  'notification':           '{{title}}',
  'otp':                    'Your {{appName}} verification code: {{code}}',
  'email-verify':           'Verify your email address for {{appName}}',
  'password-reset':         'Reset your {{appName}} password',
  'password-changed':       'Your {{appName}} password has been changed',
  'new-login':              'New sign-in to your {{appName}} account',
  'order-confirm':          'Order #{{orderId}} confirmed',
  'invoice':                'Invoice #{{invoiceId}} from {{appName}}',
  'subscription-started':   'Welcome to {{planName}} — your subscription is active',
  'subscription-cancelled': 'Your {{appName}} subscription has been cancelled',
  'trial-ending':           'Your {{appName}} trial ends in {{daysLeft}} days',
  'team-invite':            '{{inviterName}} invited you to join {{teamName}}',
  'alert':                  '[{{severity}}] {{title}}',
  'digest':                 'Your {{period}} digest — {{appName}}',
  'announcement':           '{{title}}',
  'feedback':               'Share your feedback — {{appName}}',
  'account-deleted':        'Your {{appName}} account has been deleted',
  'plain':                  '{{subject}}',
  'verification-success':   'Your email was verified for {{appName}}',
  'subscription-confirmation': 'Your {{appName}} subscription is confirmed',
  'payment-failed':         'Payment failed for your {{appName}} subscription',
  'renewal-upcoming':       'Upcoming renewal for {{appName}}',
  'subscription-resumed':   'Your {{appName}} subscription is active again',
  'refund-approved':        'Your refund from {{appName}} has been processed',
  'plan-upgraded':          'Your {{appName}} plan was upgraded',
  'plan-downgraded':        'Your {{appName}} plan was downgraded',
  'oauth-linked':           'Security alert: new sign-in provider linked',
  'database-created':       'Your database {{databaseName}} is ready',
  'database-deleted':       'Database {{databaseName}} was deleted',
  'usage-threshold':        '{{appName}} usage alert: {{percentageUsed}}% used',
  'api-key-created':        'New API key created in {{appName}}',
  'api-key-revoked':        'API key {{keyName}} revoked in {{appName}}',
  'plan-limit-reached':     'Plan limit reached for {{resourceType}} in {{appName}}',
  'email-change-requested': 'Confirm your new email for {{appName}}',
  'email-change-confirmed': 'Your email address was updated in {{appName}}',
  'phone-verify':           'Your {{appName}} phone verification code: {{code}}',
  'account-locked':         'Your {{appName}} account has been locked',
  'account-unlocked':       'Your {{appName}} account has been unlocked',
  'backup-ready':           'Your {{appName}} backup is ready to download',
  'export-ready':           'Your {{appName}} export is ready',
  'import-completed':       'Your {{appName}} import has completed',
  'maintenance-scheduled':  'Scheduled maintenance for {{appName}}',
  'incident-update':        'Incident update: {{incidentTitle}}',
  'feature-access-granted': 'Feature enabled: {{featureName}} in {{appName}}',
  'feature-access-revoked': 'Feature access removed: {{featureName}}',
  'billing-receipt':        'Your {{appName}} payment receipt {{receiptId}}',
  'payment-method-expiring': 'Your payment method for {{appName}} expires soon',
  'support-ticket-reply':   'Update on your support ticket {{ticketId}}',
};

export async function seedSystemTemplates(): Promise<void> {
  const now = new Date().toISOString();
  for (const [layoutId, { label }] of Object.entries(LAYOUTS) as [LayoutName, { label: string; variables: string[] }][]) {
    // Use findOne + insert so we only hit the write endpoint when needed
    const existing = await templates.findOne({ where: { slug: layoutId } });
    if (!existing) {
      await templates.insert({
        id: nanoid(),
        name: label,
        slug: layoutId,
        subject: SYSTEM_SUBJECTS[layoutId],
        html_body: '',
        text_body: null,
        layout: layoutId,
        is_system: 1,
        domain_id: null,
        created_at: now,
        updated_at: now,
      });
    }
  }
  if (process.env.NODE_ENV !== 'production') console.log('[db] system templates seeded');
}

