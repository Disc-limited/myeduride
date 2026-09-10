-- ============================================================
-- 016: GATE VISITOR HOST CLEARANCE & SECURITY WORKFLOW
-- Allows gate officers to assign registered visitors to school staff,
-- and allows staff to accept or decline visitor entry.
-- ============================================================

ALTER TABLE IF EXISTS gate_visitors
  ADD COLUMN IF NOT EXISTS host_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS host_response TEXT DEFAULT 'pending' CHECK (host_response IN ('pending', 'accepted', 'declined')),
  ADD COLUMN IF NOT EXISTS host_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS host_response_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_gate_visitors_host_user_id ON gate_visitors(school_id, host_user_id);
CREATE INDEX IF NOT EXISTS idx_gate_visitors_host_response ON gate_visitors(school_id, host_response);
