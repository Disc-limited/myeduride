-- ============================================================
-- EduChart Teacher-to-Parent Communication RLS Policies — Migration SQL
-- Run this on Supabase SQL Editor or via postgres CLI
-- ============================================================

-- Drop the existing permissive chat_messages_select policy
DROP POLICY IF EXISTS "chat_messages_select" ON chat_messages;

-- Create secure select policy with role partitioning
CREATE POLICY "chat_messages_select" ON chat_messages
  FOR SELECT USING (
    -- 1. School & Super Admins see all school messages
    EXISTS (
      SELECT 1 FROM user_school_roles
      WHERE user_id = auth.uid()
        AND school_id = chat_messages.school_id
        AND role IN ('school_admin', 'super_admin')
        AND is_active = TRUE
    )
    OR
    -- 2. Parents see messages for their linked students
    EXISTS (
      SELECT 1 FROM student_parents
      WHERE parent_user_id = auth.uid()
        AND student_id = chat_messages.student_id
    )
    OR
    -- 3. Teachers see messages ONLY for their assigned students
    EXISTS (
      SELECT 1 FROM students s
      JOIN teacher_profiles tp ON tp.user_id = auth.uid()
      LEFT JOIN school_classes c ON s.class_id = c.id
      LEFT JOIN teacher_class_assignments tca ON tca.teacher_profile_id = tp.id AND tca.class_id = s.class_id
      WHERE s.id = chat_messages.student_id
        AND (c.assigned_teacher_id = tp.id OR tca.id IS NOT NULL)
    )
  );

-- Drop the existing chat_messages_insert policy
DROP POLICY IF EXISTS "chat_messages_insert" ON chat_messages;

-- Create secure insert policy with role partitioning
CREATE POLICY "chat_messages_insert" ON chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND (
      -- Admins can insert messages for any student in their school
      EXISTS (
        SELECT 1 FROM user_school_roles
        WHERE user_id = auth.uid()
          AND school_id = chat_messages.school_id
          AND role IN ('school_admin', 'super_admin')
          AND is_active = TRUE
      )
      OR
      -- Parents can insert messages for their linked students
      EXISTS (
        SELECT 1 FROM student_parents
        WHERE parent_user_id = auth.uid()
          AND student_id = chat_messages.student_id
      )
      OR
      -- Teachers can insert messages ONLY for their assigned students
      EXISTS (
        SELECT 1 FROM students s
        JOIN teacher_profiles tp ON tp.user_id = auth.uid()
        LEFT JOIN school_classes c ON s.class_id = c.id
        LEFT JOIN teacher_class_assignments tca ON tca.teacher_profile_id = tp.id AND tca.class_id = s.class_id
        WHERE s.id = chat_messages.student_id
          AND (c.assigned_teacher_id = tp.id OR tca.id IS NOT NULL)
      )
    )
  );
