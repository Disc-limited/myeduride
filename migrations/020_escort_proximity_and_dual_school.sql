-- ==============================================================================
-- Migration: 020_escort_proximity_and_dual_school.sql
-- Description: Adds proximity notification timestamps and dual-school support for escorts.
-- ==============================================================================

-- 1. Add proximity notification tracking to escort_student_daily_trips
ALTER TABLE escort_student_daily_trips
  ADD COLUMN IF NOT EXISTS morning_proximity_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS afternoon_proximity_notified_at TIMESTAMPTZ;

-- 2. Add secondary school assignment support and schedule shift notes to escort_applications
ALTER TABLE escort_applications
  ADD COLUMN IF NOT EXISTS secondary_school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS schedule_shift_notes TEXT;

-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_escort_daily_trips_proximity
  ON escort_student_daily_trips (trip_date, escort_id, student_id);

CREATE INDEX IF NOT EXISTS idx_escort_apps_secondary_school
  ON escort_applications (secondary_school_id);

NOTIFY pgrst, 'reload schema';
