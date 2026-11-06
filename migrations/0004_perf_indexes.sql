-- 0004_perf_indexes.sql
-- Performance indexes for D1 analytics, logs pagination, and sequence processing

-- Domain analytics & stats breakdown
CREATE INDEX IF NOT EXISTS idx_logs_domain_status_sent ON email_logs(domain_id, status, sent_at);

-- Daily bucket aggregation & reverse chronological log queries
CREATE INDEX IF NOT EXISTS idx_logs_sent_status ON email_logs(sent_at DESC, status);

-- Sequence processor cron scanning for active enrollments
CREATE INDEX IF NOT EXISTS idx_seq_enrollments_status_enrolled ON sequence_enrollments(status, enrolled_at);
