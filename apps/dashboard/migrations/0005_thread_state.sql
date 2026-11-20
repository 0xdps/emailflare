-- Shared per-thread triage state for the team inbox (starred / archived).
-- A new inbound message clears is_archived so the thread resurfaces.

CREATE TABLE IF NOT EXISTS thread_state (
  thread_id   TEXT PRIMARY KEY,
  is_starred  INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_thread_state_archived ON thread_state (is_archived);
CREATE INDEX IF NOT EXISTS idx_thread_state_starred  ON thread_state (is_starred);
