-- ============================================================
-- MyEduRide Staff Group Chat/Meeting Rooms Infrastructure — Migration SQL
-- Run this on Supabase SQL Editor or via postgres CLI
-- ============================================================

-- 1. Create the staff_chat_rooms table
CREATE TABLE IF NOT EXISTS staff_chat_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create the staff_chat_room_participants table
CREATE TABLE IF NOT EXISTS staff_chat_room_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES staff_chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- 3. Create the staff_room_messages table
CREATE TABLE IF NOT EXISTS staff_room_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES staff_chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'audio', 'document') OR media_type IS NULL),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_chat_rooms_school 
  ON staff_chat_rooms (school_id);

CREATE INDEX IF NOT EXISTS idx_staff_chat_room_participants_user 
  ON staff_chat_room_participants (user_id);

CREATE INDEX IF NOT EXISTS idx_staff_chat_room_participants_room 
  ON staff_chat_room_participants (room_id);

CREATE INDEX IF NOT EXISTS idx_staff_room_messages_history 
  ON staff_room_messages (room_id, created_at DESC);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE staff_chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_chat_room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_room_messages ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies

-- [Rooms Select]
CREATE POLICY "staff_chat_rooms_select" ON staff_chat_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_school_roles
      WHERE user_id = auth.uid()
        AND school_id = staff_chat_rooms.school_id
        AND role IN ('school_admin', 'super_admin')
        AND is_active = TRUE
    )
    OR
    EXISTS (
      SELECT 1 FROM staff_chat_room_participants
      WHERE room_id = staff_chat_rooms.id
        AND user_id = auth.uid()
    )
  );

-- [Rooms Insert]
CREATE POLICY "staff_chat_rooms_insert" ON staff_chat_rooms
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_school_roles
      WHERE user_id = auth.uid()
        AND school_id = staff_chat_rooms.school_id
        AND role IN ('school_admin', 'super_admin')
        AND is_active = TRUE
    )
  );

-- [Rooms Update]
CREATE POLICY "staff_chat_rooms_update" ON staff_chat_rooms
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_school_roles
      WHERE user_id = auth.uid()
        AND school_id = staff_chat_rooms.school_id
        AND role IN ('school_admin', 'super_admin')
        AND is_active = TRUE
    )
  );

-- [Rooms Delete]
CREATE POLICY "staff_chat_rooms_delete" ON staff_chat_rooms
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_school_roles
      WHERE user_id = auth.uid()
        AND school_id = staff_chat_rooms.school_id
        AND role IN ('school_admin', 'super_admin')
        AND is_active = TRUE
    )
  );

-- [Participants Select]
CREATE POLICY "staff_chat_room_participants_select" ON staff_chat_room_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff_chat_rooms r
      WHERE r.id = staff_chat_room_participants.room_id
        AND (
          EXISTS (
            SELECT 1 FROM user_school_roles usr
            WHERE usr.user_id = auth.uid()
              AND usr.school_id = r.school_id
              AND usr.role IN ('school_admin', 'super_admin')
              AND usr.is_active = TRUE
          )
          OR
          EXISTS (
            SELECT 1 FROM staff_chat_room_participants p2
            WHERE p2.room_id = r.id
              AND p2.user_id = auth.uid()
          )
        )
    )
  );

-- [Participants All Admin]
CREATE POLICY "staff_chat_room_participants_all_admin" ON staff_chat_room_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff_chat_rooms r
      JOIN user_school_roles usr ON usr.school_id = r.school_id
      WHERE r.id = staff_chat_room_participants.room_id
        AND usr.user_id = auth.uid()
        AND usr.role IN ('school_admin', 'super_admin')
        AND usr.is_active = TRUE
    )
  );

-- [Messages Select]
CREATE POLICY "staff_room_messages_select" ON staff_room_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_school_roles
      WHERE user_id = auth.uid()
        AND school_id = staff_room_messages.school_id
        AND role IN ('school_admin', 'super_admin')
        AND is_active = TRUE
    )
    OR
    EXISTS (
      SELECT 1 FROM staff_chat_room_participants
      WHERE room_id = staff_room_messages.room_id
        AND user_id = auth.uid()
    )
  );

-- [Messages Insert]
CREATE POLICY "staff_room_messages_insert" ON staff_room_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM staff_chat_room_participants
      WHERE room_id = staff_room_messages.room_id
        AND user_id = auth.uid()
    )
  );

-- 7. Enable Supabase Realtime for the new tables
ALTER PUBLICATION supabase_realtime ADD TABLE staff_chat_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE staff_chat_room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE staff_room_messages;
