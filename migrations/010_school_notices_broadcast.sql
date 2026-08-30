-- Migration 010: School Notices & School-Wide Broadcast Table
CREATE TABLE IF NOT EXISTS school_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT DEFAULT 'general', -- general, public_holiday, urgent, event, emergency
  target_audiences TEXT[] DEFAULT ARRAY['parents', 'teachers', 'escorts', 'gate_officers'],
  recipient_count INT DEFAULT 0,
  send_email BOOLEAN DEFAULT TRUE,
  media_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by school and creation date
CREATE INDEX IF NOT EXISTS idx_school_notices_school_date ON school_notices(school_id, created_at DESC);

-- Enable RLS and Realtime
ALTER TABLE school_notices ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'school_notices' AND policyname = 'Public select for school notices'
  ) THEN
    CREATE POLICY "Public select for school notices" ON school_notices FOR SELECT USING (true);
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE school_notices;
