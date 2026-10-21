-- ============================================================
-- 017: VISITOR EXPECTED DURATION AND TIME-LEFT TRACKING
-- Adds expected duration in minutes and reason fields for visitor entry passes
-- ============================================================

ALTER TABLE IF EXISTS gate_visitors
  ADD COLUMN IF NOT EXISTS expected_duration_minutes INT DEFAULT 60,
  ADD COLUMN IF NOT EXISTS decline_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_gate_visitors_entry_expected ON gate_visitors(school_id, entry_time DESC, expected_duration_minutes);
