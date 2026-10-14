-- ============================================================
-- 028_accurate_signin_signout_location.sql
-- Enables accurate sign in/out physical location & GPS coordinates
-- tracking for both students and staff, verifying exact gate reception.
-- ============================================================

-- 1. Extend attendance_records (student sign in / out)
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS gps_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS gps_lng NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS geofence_verified BOOLEAN DEFAULT true;

-- 2. Extend staff_attendance (staff sign in / out)
ALTER TABLE staff_attendance
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS gps_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS gps_lng NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS geofence_verified BOOLEAN DEFAULT true;

-- 3. Extend gate_activity_logs (gate officer actions)
ALTER TABLE gate_activity_logs
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS gps_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS gps_lng NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS geofence_verified BOOLEAN DEFAULT true;

-- 4. Indexes for location analytics
CREATE INDEX IF NOT EXISTS idx_attendance_records_location
  ON attendance_records(school_id, location_name);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_location
  ON staff_attendance(school_id, location_name);
