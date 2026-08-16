-- Scope conversations ("people") by counterparty email + inbox address.
--
-- Previously a person was keyed by sender email alone, so one sender writing
-- to two different inbox addresses was merged into a single thread. A
-- conversation is now uniquely identified by (email, inbox_address):
--   • inbound  → counterparty email = sender, inbox_address = recipient inbox
--   • outbound → counterparty email = recipient, inbox_address = sending inbox
--
-- This migration also SPLITS any existing merged conversations so past data is
-- corrected too.

-- 1. Rebuild people with composite uniqueness.
CREATE TABLE people_new (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  name          TEXT,
  inbox_address TEXT,
  created_at    TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_people_email_inbox ON people_new (email, inbox_address);

-- 2. One row per distinct (email, inbox_address) seen in inbound mail.
INSERT INTO people_new (id, email, name, inbox_address, created_at)
SELECT
  p.id || ':' || ie.inbox_address AS id,
  p.email,
  p.name,
  ie.inbox_address,
  p.created_at
FROM people p
JOIN inbox_emails ie ON ie.person_id = p.id
WHERE ie.inbox_address IS NOT NULL AND ie.inbox_address <> ''
GROUP BY p.id, ie.inbox_address;

-- 3. Keep original id for people with NO inbound mail (outbound-only).
INSERT INTO people_new (id, email, name, inbox_address, created_at)
SELECT p.id, p.email, p.name, NULL, p.created_at
FROM people p
WHERE NOT EXISTS (SELECT 1 FROM inbox_emails ie WHERE ie.person_id = p.id);

-- 4. Re-point inbound emails to the split conversation row.
UPDATE inbox_emails
SET person_id = (
  SELECT pn.id
  FROM people_new pn
  JOIN people p ON pn.email = p.email
  WHERE p.id = inbox_emails.person_id
    AND pn.inbox_address = inbox_emails.inbox_address
  LIMIT 1
)
WHERE inbox_emails.person_id IS NOT NULL;

-- 5. Re-point sent emails to the conversation matching (recipient, sending inbox).
UPDATE sent_inbox_emails
SET person_id = (
  SELECT pn.id
  FROM people_new pn
  WHERE pn.email = sent_inbox_emails.to_address
    AND pn.inbox_address = sent_inbox_emails.from_address
  LIMIT 1
)
WHERE sent_inbox_emails.person_id IS NOT NULL;

-- 6. Swap in the new table.
DROP TABLE people;
ALTER TABLE people_new RENAME TO people;
