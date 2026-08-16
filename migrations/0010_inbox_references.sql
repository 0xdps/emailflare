-- Add references header to inbox emails for proper RFC 5322 threading.
-- `references` holds the ancestor Message-ID chain (root → … → parent), which
-- is what actually links replies/forwards into a thread — as opposed to the
-- counterparty-based grouping we had before.
ALTER TABLE inbox_emails ADD COLUMN "references" TEXT;

-- Sent emails also carry a references chain so outbound replies attach to the
-- correct thread root and future inbound replies can link back.
ALTER TABLE sent_inbox_emails ADD COLUMN "references" TEXT;
