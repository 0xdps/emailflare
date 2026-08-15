-- Inbox tables — users, CRM, inboxes, email threads, sequences, push.
-- The Email API tables (domains, templates, api_keys, email_logs, suppressions)
-- are created by 0001_schema.sql and 0003_bounce_suppression.sql.

-- ── Users & Auth ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('super-admin', 'admin', 'member')),
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

-- ── CRM: People ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS people (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_people_email ON people (email);

-- ── Inboxes & Members ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inboxes (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  mode         TEXT NOT NULL DEFAULT 'thread' CHECK (mode IN ('thread', 'individual')),
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inbox_members (
  inbox_id TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  PRIMARY KEY (inbox_id, user_id)
);

-- ── Received Emails ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inbox_emails (
  id            TEXT PRIMARY KEY,
  person_id     TEXT NOT NULL,
  inbox_address TEXT NOT NULL,
  subject       TEXT NOT NULL,
  body_html     TEXT,
  body_text     TEXT,
  body_r2_key   TEXT,
  message_id    TEXT UNIQUE,
  in_reply_to   TEXT,
  spf           TEXT,
  dkim          TEXT,
  dmarc         TEXT,
  is_read       INTEGER NOT NULL DEFAULT 0,
  received_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inbox_emails_person_id   ON inbox_emails (person_id);
CREATE INDEX IF NOT EXISTS idx_inbox_emails_inbox_addr  ON inbox_emails (inbox_address);
CREATE INDEX IF NOT EXISTS idx_inbox_emails_received_at ON inbox_emails (received_at DESC);

-- ── Sent Emails ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sent_inbox_emails (
  id              TEXT PRIMARY KEY,
  person_id       TEXT,
  in_reply_to     TEXT,
  from_address    TEXT NOT NULL,
  to_address      TEXT NOT NULL,
  subject         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  cf_message_id   TEXT,
  sent_at         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sent_inbox_emails_person_id ON sent_inbox_emails (person_id);

-- ── Attachments ───────────────────────────────────────────────────────────────

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

-- ── Inbox Templates ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inbox_templates (
  id         TEXT PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  subject    TEXT NOT NULL,
  body_html  TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ── Sequences ─────────────────────────────────────────────────────────────────

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

-- ── Push Subscriptions ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON push_subscriptions (user_id);
