-- Audit log, outbound webhooks, scheduled sends, open/click tracking, and TOTP.

ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS user_backup_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_backup_codes_user ON user_backup_codes(user_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_sends (
  id TEXT PRIMARY KEY,
  api_key_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  idempotency_key TEXT,
  send_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduled_due ON scheduled_sends(status, send_at);

CREATE TABLE IF NOT EXISTS email_events (
  id TEXT PRIMARY KEY,
  email_log_id TEXT,
  token TEXT NOT NULL,
  kind TEXT NOT NULL,
  url TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_events_token ON email_events(token);
