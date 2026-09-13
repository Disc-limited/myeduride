-- ============================================================
-- 019: ESCORT STUDENT DAILY TRIPS & GATE RECONCILIATION
-- Tracks daily doorstep pickups by escorts, gate drop-offs,
-- afternoon gate releases, and final home drop-offs.
-- ============================================================

CREATE TABLE IF NOT EXISTS escort_student_daily_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_date DATE NOT NULL DEFAULT CURRENT_DATE,
  escort_id TEXT NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  morning_picked_up BOOLEAN NOT NULL DEFAULT FALSE,
  morning_picked_up_at TIMESTAMPTZ,
  morning_pin_verified BOOLEAN NOT NULL DEFAULT FALSE,
  afternoon_picked_up BOOLEAN NOT NULL DEFAULT FALSE,
  afternoon_picked_up_at TIMESTAMPTZ,
  afternoon_dropped_off BOOLEAN NOT NULL DEFAULT FALSE,
  afternoon_dropped_off_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_escort_student_daily_trip UNIQUE (trip_date, escort_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_escort_student_daily_trips_date_escort
  ON escort_student_daily_trips (trip_date, escort_id);

CREATE INDEX IF NOT EXISTS idx_escort_student_daily_trips_morning_pickup
  ON escort_student_daily_trips (trip_date, escort_id, morning_picked_up);

CREATE INDEX IF NOT EXISTS idx_escort_student_daily_trips_student
  ON escort_student_daily_trips (student_id, trip_date);
