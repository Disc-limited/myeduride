-- ==============================================================================
-- Migration 034: Fix Student Foreign Key Constraints (Cascade & Disassociate)
--
-- Senior Software Engineering Solution:
-- Prevents foreign key constraint violations when deleting students (e.g. registered
-- to the wrong school by mistake or removed by school admin/super admin).
--
-- 1. gate_activity_logs: ON DELETE SET NULL (preserves gate officer shift audit logs)
-- 2. notifications: ON DELETE CASCADE (cleans up obsolete student notifications)
-- ==============================================================================

DO $$
BEGIN
  -- 1. gate_activity_logs -> students(id) ON DELETE SET NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'gate_activity_logs_student_id_fkey'
      AND table_name = 'gate_activity_logs'
  ) THEN
    ALTER TABLE gate_activity_logs DROP CONSTRAINT gate_activity_logs_student_id_fkey;
  END IF;

  ALTER TABLE gate_activity_logs
    ADD CONSTRAINT gate_activity_logs_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;

  -- 2. notifications -> students(id) ON DELETE CASCADE
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notifications_student_id_fkey'
      AND table_name = 'notifications'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_student_id_fkey;
  END IF;

  ALTER TABLE notifications
    ADD CONSTRAINT notifications_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
END $$;
