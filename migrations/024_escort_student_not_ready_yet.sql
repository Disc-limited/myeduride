-- ==============================================================================
-- Migration: 024_escort_student_not_ready_yet.sql
-- Description: Adds real-time readiness status, delay duration, and shifted pickup
--              timestamp columns to escort_student_daily_trips.
--              Enables parents to flag "Not Ready Yet" and escorts to automatically
--              re-order their pickup queue to service ready children first.
-- ==============================================================================

-- 1. Ensure escort_student_daily_trips table has all readiness & cancellation columns
ALTER TABLE escort_student_daily_trips
  ADD COLUMN IF NOT EXISTS is_not_ready_yet BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS readiness_status TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS delayed_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shifted_pickup_time TEXT,
  ADD COLUMN IF NOT EXISTS not_ready_reason TEXT,
  ADD COLUMN IF NOT EXISTS not_ready_notes TEXT,
  ADD COLUMN IF NOT EXISTS not_ready_at TIMESTAMPTZ,
  -- Also ensure parent cancellation columns exist
  ADD COLUMN IF NOT EXISTS is_canceled_by_parent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_notes TEXT;

-- 2. Indexes for fast status checks during route construction and live dashboards
CREATE INDEX IF NOT EXISTS idx_escort_daily_trips_readiness
  ON escort_student_daily_trips (trip_date, escort_id, readiness_status);

CREATE INDEX IF NOT EXISTS idx_escort_daily_trips_not_ready
  ON escort_student_daily_trips (trip_date, student_id, is_not_ready_yet);

CREATE INDEX IF NOT EXISTS idx_escort_daily_trips_canceled
  ON escort_student_daily_trips (trip_date, student_id, is_canceled_by_parent);

-- 3. Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
