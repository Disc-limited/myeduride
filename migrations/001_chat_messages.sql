-- ============================================================
-- EduChart Scalable Chat Infrastructure — Migration SQL
-- Run this on Supabase SQL Editor BEFORE deploying code changes
-- ============================================================

-- 1. Create the chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  student_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  sender_name TEXT NOT NULL DEFAULT '',
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('parent', 'teacher', 'school', 'admin')),
  title TEXT,
  content TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'audio', 'document') OR media_type IS NULL),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create indexes for the two primary query patterns
-- Thread-based queries: get chat history for a student at a school
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread
  ON chat_messages (school_id, student_id, created_at DESC);

-- Unread message lookups (partial index for efficiency)
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread
  ON chat_messages (school_id, student_id, is_read)
  WHERE is_read = FALSE;

-- Per-user sent messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender
  ON chat_messages (sender_id, created_at DESC);

-- 3. Enable Row Level Security
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Allow reading for users in the same school or linked parents
CREATE POLICY "chat_messages_select" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_school_roles
      WHERE user_id = auth.uid()
        AND school_id = chat_messages.school_id
        AND is_active = TRUE
    )
    OR
    EXISTS (
      SELECT 1 FROM student_parents
      WHERE parent_user_id = auth.uid()
        AND student_id = chat_messages.student_id
    )
  );

-- Allow inserting for authenticated users (sender must be self)
CREATE POLICY "chat_messages_insert" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 5. Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- ============================================================
-- 6. Backfill existing chat data from notifications table
-- ============================================================
INSERT INTO chat_messages (school_id, student_id, sender_id, sender_name, recipient_type, title, content, media_url, created_at, is_read)
SELECT
  n.school_id,
  n.student_id,
  -- Extract sender_id from [sender_id:UUID] prefix
  COALESCE(
    (regexp_match(n.message, '^\[sender_id:([^\]]+)\]'))[1]::UUID,
    n.user_id::UUID
  ) AS sender_id,
  -- Extract sender name from [Message from Name]:
  COALESCE(
    (regexp_match(
      -- Strip [sender_id:...] first
      regexp_replace(n.message, '^\[sender_id:[^\]]+\]', ''),
      '^\[Message from ([^\]]+)\]'
    ))[1],
    'Unknown'
  ) AS sender_name,
  -- Determine recipient_type from title
  CASE
    WHEN n.title LIKE '%Parent to Teacher%' THEN 'teacher'
    WHEN n.title LIKE '%Parent to School%' THEN 'school'
    WHEN n.title LIKE '%Teacher to Parent%' THEN 'parent'
    WHEN n.title LIKE '%School to Parent%' THEN 'parent'
    WHEN n.title LIKE '%Admin to Parent%' THEN 'parent'
    WHEN n.title LIKE '%Teacher to Teacher%' THEN 'teacher'
    WHEN n.title LIKE '%Admin to Teacher%' THEN 'teacher'
    WHEN n.title LIKE '%Teacher to School%' THEN 'school'
    WHEN n.title LIKE '%Admin to School%' THEN 'school'
    ELSE 'school'
  END AS recipient_type,
  n.title,
  -- Clean message: strip [sender_id:...] and [Message from ...]:
  TRIM(
    regexp_replace(
      regexp_replace(n.message, '^\[sender_id:[^\]]+\]', ''),
      '^\[Message from [^\]]+\]:\s*', ''
    )
  ) AS content,
  n.media_url,
  n.created_at,
  n.is_read
FROM notifications n
WHERE n.type = 'system'
  AND (
    n.title LIKE 'Chat:%'
    OR n.title LIKE 'Parent Message:%'
    OR n.title LIKE 'Reply:%'
  )
  AND n.student_id IS NOT NULL
  AND n.school_id IS NOT NULL
-- Deduplicate: only take the first copy of each message (same content + timestamp)
-- since the old system created one notification row per recipient
ON CONFLICT DO NOTHING;

-- Deduplicate the backfilled data (keep one row per unique message)
DELETE FROM chat_messages a
USING chat_messages b
WHERE a.id > b.id
  AND a.content = b.content
  AND a.created_at = b.created_at
  AND a.student_id = b.student_id
  AND a.sender_id = b.sender_id;
