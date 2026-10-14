-- Suppressions: lowercase addresses, and allow one row per
-- (email, reason, list) instead of one row per email.
--
-- Fresh installs already create idx_suppressions_identity in 0001. This file
-- repairs databases that applied the older unique index on email alone.
-- Send still treats any row for an address as a global block.

DROP INDEX IF EXISTS idx_suppressions_email;
DROP INDEX IF EXISTS idx_suppressions_identity;

UPDATE suppressions SET email = lower(email) WHERE email != lower(email);
UPDATE unsubscribe_tokens SET email = lower(email) WHERE email != lower(email);

DELETE FROM suppressions
WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM suppressions
  GROUP BY email, reason, IFNULL(list_id, '')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppressions_identity
  ON suppressions(email, reason, IFNULL(list_id, ''));
