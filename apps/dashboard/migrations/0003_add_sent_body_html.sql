-- Add body_html column to sent_inbox_emails for full HTML email history rendering
ALTER TABLE sent_inbox_emails ADD COLUMN body_html TEXT;
