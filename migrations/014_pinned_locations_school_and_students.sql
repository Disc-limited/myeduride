-- ============================================================
-- 014_pinned_locations_school_and_students.sql
-- Enables School Admins to pin School/Campus Gate GPS coordinates
-- and Parents to pin their Child/Children house pickup locations.
-- ============================================================

-- 1. Extend schools table with campus geolocation coordinates
ALTER TABLE schools 
  ADD COLUMN IF NOT EXISTS gps_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS gps_lng NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS location_address TEXT,
  ADD COLUMN IF NOT EXISTS location_landmark TEXT,
  ADD COLUMN IF NOT EXISTS location_pinned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS location_pinned_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- 2. Extend students table with home pickup coordinates and landmark metadata
ALTER TABLE students 
  ADD COLUMN IF NOT EXISTS house_address TEXT,
  ADD COLUMN IF NOT EXISTS house_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS house_lng NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS house_landmark TEXT,
  ADD COLUMN IF NOT EXISTS house_notes TEXT,
  ADD COLUMN IF NOT EXISTS house_pinned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS house_pinned_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- 3. Spatial/Coordinate Indexes for fast bounding box and route corridor matching
CREATE INDEX IF NOT EXISTS idx_schools_gps_coords 
  ON schools(gps_lat, gps_lng) 
  WHERE gps_lat IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_house_coords 
  ON students(house_lat, house_lng) 
  WHERE house_lat IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_house_pinned_by 
  ON students(house_pinned_by) 
  WHERE house_pinned_by IS NOT NULL;
