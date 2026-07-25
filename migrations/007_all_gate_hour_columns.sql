-- Migration: 007_all_gate_hour_columns.sql
-- Idempotently ensures ALL gate-hour columns exist on the schools table.
-- Safe to re-run: uses IF NOT EXISTS on each column.
-- Run this in Supabase SQL Editor.

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS gate_open_time      TIME DEFAULT '06:30',
  ADD COLUMN IF NOT EXISTS school_start_time   TIME DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS late_threshold      TIME DEFAULT '08:15',
  ADD COLUMN IF NOT EXISTS gate_close_time     TIME DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS dismissal_start_time TIME DEFAULT '14:00',
  ADD COLUMN IF NOT EXISTS dismissal_end_time  TIME DEFAULT '16:00',
  ADD COLUMN IF NOT EXISTS staff_gate_start    TIME DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS staff_gate_end      TIME DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS student_gate_start  TIME DEFAULT '07:30',
  ADD COLUMN IF NOT EXISTS student_gate_end    TIME DEFAULT '15:00';

-- Reload PostgREST schema cache so the new columns are visible immediately.
NOTIFY pgrst, 'reload schema';
