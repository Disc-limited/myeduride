-- ============================================================
-- MyEduRide Staff Private Chat Infrastructure — Migration SQL
-- Run this on Supabase SQL Editor or via postgres CLI
-- ============================================================

-- 1. Create the staff_private_messages table
CREATE TABLE IF NOT EXISTS staff_private_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'audio', 'document') OR media_type IS NULL),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_private_messages_history
  ON staff_private_messages (school_id, sender_id, recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_private_messages_unread
  ON staff_private_messages (recipient_id, is_read)
  WHERE is_read = FALSE;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE staff_private_messages ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Only the sender and recipient can read private messages
CREATE POLICY "staff_private_messages_select" ON staff_private_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
  );

-- The sender must be the authenticated user, and both parties must be active staff members of the same school
DROP POLICY IF EXISTS "staff_private_messages_insert" ON staff_private_messages;
CREATE POLICY "staff_private_messages_insert" ON staff_private_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM user_school_roles sender_role
      JOIN user_school_roles recipient_role ON sender_role.school_id = recipient_role.school_id
      WHERE sender_role.user_id = auth.uid()
        AND recipient_role.user_id = staff_private_messages.recipient_id
        AND sender_role.school_id = staff_private_messages.school_id
        AND sender_role.is_active = TRUE
        AND recipient_role.is_active = TRUE
        AND sender_role.role IN ('school_admin', 'teacher', 'gate_officer', 'staff')
        AND recipient_role.role IN ('school_admin', 'teacher', 'gate_officer', 'staff')
    )
  );

-- Only the recipient of a message can mark it as read
CREATE POLICY "staff_private_messages_update" ON staff_private_messages
  FOR UPDATE USING (
    auth.uid() = recipient_id
  );

-- 5. Create user_presence table for online/offline tracking
CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can see user presence
CREATE POLICY "user_presence_select" ON user_presence
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Users can upsert their own presence records
CREATE POLICY "user_presence_upsert" ON user_presence
  FOR ALL USING (auth.uid() = user_id);

-- 6. Enable Supabase Realtime for staff_private_messages
ALTER PUBLICATION supabase_realtime ADD TABLE staff_private_messages;
