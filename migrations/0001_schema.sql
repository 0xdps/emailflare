-- emailflare D1 schema
-- Apply with: wrangler d1 migrations apply emailflare [--local]

CREATE TABLE IF NOT EXISTS domains (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE,
  cf_zone_id       TEXT NOT NULL,
  cf_subdomain_id  TEXT,
  dkim_selector    TEXT,
  return_path_domain TEXT,
  verified         INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
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
  sent_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_sent_at   ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_logs_status    ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_logs_api_key   ON email_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_logs_domain    ON email_logs(domain_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_logs_idempotency ON email_logs(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
