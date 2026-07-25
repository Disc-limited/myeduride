-- Migration: 005_staff_multiple_roles.sql
-- Add teacher responsibility options to teacher_profiles and backfill roles.

ALTER TABLE teacher_profiles
  ADD COLUMN teacher_responsibility TEXT CHECK (
    teacher_responsibility IN ('class_teacher', 'subject_teacher', 'both')
  ) DEFAULT NULL;

-- 1. Backfill existing teacher profiles:
-- Anyone who has the active 'teacher' role in user_school_roles gets defaulted to 'class_teacher'.
UPDATE teacher_profiles
SET teacher_responsibility = 'class_teacher'
WHERE user_id IN (
  SELECT r.user_id 
  FROM user_school_roles r
  WHERE r.role = 'teacher' AND r.is_active = true
);

-- 2. Ensure every employee (teacher, gate_officer) also has the 'staff' role assigned.
-- This guarantees they have all basic staff permissions (dashboard, attendance, private chat).
INSERT INTO user_school_roles (user_id, school_id, role, is_active)
SELECT DISTINCT user_id, school_id, 'staff', is_active
FROM user_school_roles
WHERE role IN ('teacher', 'gate_officer')
ON CONFLICT (user_id, school_id, role) DO NOTHING;
