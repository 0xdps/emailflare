-- Bounce handling & suppression list.
-- email_logs.status already stores TEXT; 'bounced' and 'complained' are new
-- valid values — no schema change needed for the column itself.
-- We add bounced_at to record when the async notification arrived.

ALTER TABLE email_logs ADD COLUMN bounced_at TEXT;

-- Suppression list: addresses that must not receive further mail.
-- reason: 'hard_bounce' | 'soft_bounce' | 'complaint' | 'manual'
CREATE TABLE IF NOT EXISTS suppressions (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL,
  reason       TEXT NOT NULL DEFAULT 'hard_bounce',
  domain_id    TEXT,
  email_log_id TEXT,
  created_at   TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppressions_email  ON suppressions(email);
CREATE INDEX        IF NOT EXISTS idx_suppressions_domain ON suppressions(domain_id);
