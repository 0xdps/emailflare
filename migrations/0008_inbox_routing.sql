-- Persist Cloudflare Email Routing state per inbox.
-- routing_configured = 1 when the zone's catch-all rule routes inbound mail to
-- the inbox worker; routing_error stores the last failure message when not.

ALTER TABLE inboxes ADD COLUMN routing_configured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inboxes ADD COLUMN routing_error TEXT;
