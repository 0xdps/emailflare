-- Add 'tester' role — a restricted role that can only access the Test Mailbox.
-- SQLite cannot ALTER a CHECK constraint, so recreate the users table with the
-- expanded role set. Preserves all existing rows.

CREATE TABLE users_new (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('super-admin', 'admin', 'member', 'tester')),
  created_at    TEXT NOT NULL
);

INSERT INTO users_new SELECT id, name, email, password_hash, role, created_at FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
