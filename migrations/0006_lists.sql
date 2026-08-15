-- Lists (audiences) for unsubscribe management.
-- A list groups sends so a recipient can unsubscribe from a specific list.
-- Unsubscribes write a `suppressions` row (reason 'unsubscribed'); the list_id
-- records attribution. Enforcement remains global (an unsubscribed address is
-- suppressed for all sends).

CREATE TABLE IF NOT EXISTS lists (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE,
  description TEXT,
  domain_id   TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lists_domain ON lists(domain_id);

-- Suppressions gain an optional list_id for attribution.
ALTER TABLE suppressions ADD COLUMN list_id TEXT;
CREATE INDEX IF NOT EXISTS idx_suppressions_list ON suppressions(list_id);

-- One-time unsubscribe tokens issued at send time. The public unsubscribe
-- endpoint resolves a token to (email, list_id) so links can't be forged.
CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
  token      TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  list_id    TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_email ON unsubscribe_tokens(email);

