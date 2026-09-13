-- ============================================================
-- 018: EXPAND CHAT MESSAGES RECIPIENT TYPES FOR ESCORTS & GATE
-- Enables chat communication between Escorts, Parents, Gate Officers,
-- and City Managers without violating check constraints.
-- ============================================================

-- 1. Drop old restrictive recipient_type check constraint
ALTER TABLE IF EXISTS chat_messages 
  DROP CONSTRAINT IF EXISTS chat_messages_recipient_type_check;

-- 2. Re-create constraint with all operational recipient roles
ALTER TABLE IF EXISTS chat_messages 
  ADD CONSTRAINT chat_messages_recipient_type_check 
  CHECK (recipient_type IN (
    'parent',
    'teacher',
    'school',
    'admin',
    'gate_officer',
    'gate',
    'city_manager',
    'super_admin',
    'escort',
    'myeduride_escort',
    'school_escort',
    'staff'
  ));

-- 3. Create index for faster escort & role-based recipient lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient_type 
  ON chat_messages (recipient_type, school_id, created_at DESC);
