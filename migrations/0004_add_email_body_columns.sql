-- Add html_body and text_body columns to email_logs for in-house test mailbox storage
ALTER TABLE email_logs ADD COLUMN html_body TEXT;
ALTER TABLE email_logs ADD COLUMN text_body TEXT;
