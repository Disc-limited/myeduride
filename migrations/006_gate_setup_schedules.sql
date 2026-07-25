-- Migration: 006_gate_setup_schedules.sql
-- Add independent staff and student gate hours to schools table.

ALTER TABLE schools
  ADD COLUMN staff_gate_start TIME DEFAULT '07:00',
  ADD COLUMN staff_gate_end TIME DEFAULT '17:00',
  ADD COLUMN student_gate_start TIME DEFAULT '07:30',
  ADD COLUMN student_gate_end TIME DEFAULT '15:00';
