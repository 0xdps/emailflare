-- Migration: add body_text to sent_inbox_emails
-- The compose endpoint stores the outbound message body so it can be displayed
-- in the thread view alongside inbound emails.

ALTER TABLE sent_inbox_emails ADD COLUMN body_text TEXT;