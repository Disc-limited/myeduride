-- =========================================================
-- Migration: 025_school_day_schedules.sql
-- Per-weekday schedule overrides (e.g. Friday early release)
-- day_of_week: 0=Sunday 1=Monday 2=Tuesday 3=Wednesday
--              4=Thursday 5=Friday 6=Saturday
-- =========================================================

CREATE TABLE IF NOT EXISTS school_day_schedules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  day_of_week           SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),

  -- Per-day gate / schedule overrides (all nullable — NULL = inherit global setting)
  gate_open_time        TIME,
  school_start_time     TIME,
  late_threshold        TIME,
  gate_close_time       TIME,
  dismissal_start_time  TIME,   -- KEY: Friday 12:30, others NULL (inherit global 14:00)
  dismissal_end_time    TIME,
  student_gate_start    TIME,
  student_gate_end      TIME,
  staff_gate_start      TIME,
  staff_gate_end        TIME,

  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  notes                 TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_school_day_schedule UNIQUE (school_id, day_of_week)
);

-- Efficient lookup by school + day
CREATE INDEX IF NOT EXISTS idx_school_day_schedules_school_day
  ON school_day_schedules (school_id, day_of_week);

-- Auto-update updated_at on change
CREATE OR REPLACE FUNCTION update_school_day_schedules_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_school_day_schedules_updated_at ON school_day_schedules;
CREATE TRIGGER trg_school_day_schedules_updated_at
  BEFORE UPDATE ON school_day_schedules
  FOR EACH ROW EXECUTE FUNCTION update_school_day_schedules_updated_at();

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
