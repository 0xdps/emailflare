-- ═══════════════════════════════════════════════════════════════════════════
--  EmailFlare — consolidated schema (fresh install)
-- ═══════════════════════════════════════════════════════════════════════════
--  Single source of truth for the shared `emailflare` D1 database, used by:
--    • email-worker  (transactional sending)   — D1 via wrangler
--    • inbox-worker  (hosted inboxes)          — D1 via wrangler
--    • inbox-server  (Node.js)                 — MesaHub, reads this dir
--
--  Final, de-duplicated schema: every column declared inline at its final
--  state. No ALTERs, no backfills. Apply on a fresh database.

-- ═════════════════════════════════════════════════════════════════════════════
--  Email API (sending)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS domains (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL UNIQUE,
  cf_zone_id         TEXT NOT NULL,
  cf_subdomain_id    TEXT,
  dkim_selector      TEXT,
  return_path_domain TEXT,
  verified           INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL
);

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
);

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
);

CREATE TABLE IF NOT EXISTS api_key_domains (
  api_key_id  TEXT NOT NULL,
  domain_id   TEXT NOT NULL,
  PRIMARY KEY (api_key_id, domain_id)
);

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
  bounced_at       TEXT,
  html_body        TEXT,
  text_body        TEXT,
  sent_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_sent_at   ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_logs_status    ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_logs_api_key   ON email_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_logs_domain    ON email_logs(domain_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_logs_idempotency ON email_logs(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── Suppressions ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS suppressions (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL,
  reason       TEXT NOT NULL DEFAULT 'hard_bounce',
  domain_id    TEXT,
  email_log_id TEXT,
  list_id      TEXT,
  created_at   TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppressions_email  ON suppressions(email);
CREATE INDEX        IF NOT EXISTS idx_suppressions_domain ON suppressions(domain_id);
CREATE INDEX        IF NOT EXISTS idx_suppressions_list   ON suppressions(list_id);

-- ── Lists (audiences) ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lists (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE,
  description TEXT,
  domain_id   TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lists_domain ON lists(domain_id);

-- ── One-time unsubscribe tokens ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
  token      TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  list_id    TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_email ON unsubscribe_tokens(email);

-- ═════════════════════════════════════════════════════════════════════════════
--  Inbox (receiving)
-- ═════════════════════════════════════════════════════════════════════════════

-- ── Users & Auth ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member'
                 CHECK (role IN ('super-admin', 'admin', 'member', 'tester')),
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS invites (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  created_by  TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member',
  expires_at  TEXT NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invites_token_hash ON invites (token_hash);

-- ── People (counterparty, scoped by inbox address) ──────────────────────────

CREATE TABLE IF NOT EXISTS people (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  name          TEXT,
  inbox_address TEXT,
  created_at    TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_people_email_inbox ON people (email, inbox_address);

-- ── Inboxes & Members ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inboxes (
  id                 TEXT PRIMARY KEY,
  email              TEXT NOT NULL UNIQUE,
  display_name       TEXT NOT NULL,
  mode               TEXT NOT NULL DEFAULT 'thread'
                      CHECK (mode IN ('thread', 'individual')),
  routing_configured INTEGER NOT NULL DEFAULT 0,
  routing_error      TEXT,
  created_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inbox_members (
  inbox_id TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  PRIMARY KEY (inbox_id, user_id)
);

-- ── Received Emails ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inbox_emails (
  id            TEXT PRIMARY KEY,
  person_id     TEXT NOT NULL,
  thread_id     TEXT NOT NULL,
  inbox_address TEXT NOT NULL,
  subject       TEXT NOT NULL,
  body_html     TEXT,
  body_text     TEXT,
  body_r2_key   TEXT,
  message_id    TEXT UNIQUE,
  in_reply_to   TEXT,
  "references"  TEXT,
  spf           TEXT,
  dkim          TEXT,
  dmarc         TEXT,
  is_read       INTEGER NOT NULL DEFAULT 0,
  received_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inbox_emails_person_id   ON inbox_emails (person_id);
CREATE INDEX IF NOT EXISTS idx_inbox_emails_thread_id   ON inbox_emails (thread_id);
CREATE INDEX IF NOT EXISTS idx_inbox_emails_inbox_addr  ON inbox_emails (inbox_address);
CREATE INDEX IF NOT EXISTS idx_inbox_emails_received_at ON inbox_emails (received_at DESC);

-- ── Sent Emails ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sent_inbox_emails (
  id              TEXT PRIMARY KEY,
  person_id       TEXT,
  thread_id       TEXT NOT NULL,
  in_reply_to     TEXT,
  "references"    TEXT,
  message_id      TEXT,
  thread_token    TEXT,
  from_address    TEXT NOT NULL,
  to_address      TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body_text       TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  cf_message_id   TEXT,
  sent_at         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sent_inbox_emails_person_id ON sent_inbox_emails (person_id);
CREATE INDEX IF NOT EXISTS idx_sent_inbox_emails_thread_id ON sent_inbox_emails (thread_id);

-- ── Attachments ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attachments (
  id           TEXT PRIMARY KEY,
  email_id     TEXT NOT NULL,
  filename     TEXT NOT NULL,
  content_type TEXT NOT NULL,
  r2_key       TEXT NOT NULL,
  size         INTEGER NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_email_id ON attachments (email_id);

-- ── Inbox Templates ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inbox_templates (
  id         TEXT PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  subject    TEXT NOT NULL,
  body_html  TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ── Sequences ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sequences (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  steps      TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id           TEXT PRIMARY KEY,
  sequence_id  TEXT NOT NULL,
  person_id    TEXT NOT NULL,
  from_address TEXT NOT NULL,
  variables    TEXT NOT NULL DEFAULT '{}',
  current_step INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  enrolled_at  TEXT NOT NULL,
  UNIQUE (sequence_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_seq_enrollments_status ON sequence_enrollments (status);
CREATE INDEX IF NOT EXISTS idx_seq_enrollments_person  ON sequence_enrollments (person_id);

-- ── Push Subscriptions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON push_subscriptions (user_id);
