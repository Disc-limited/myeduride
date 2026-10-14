-- ==============================================================================
-- Migration 029: PostGIS Extension & GiST Spatial Acceleration Engine
-- Enables native R-Tree spatial indexing for sub-millisecond proximity detection
-- and zero-overhead geofence verification across schools, students, and shuttles.
-- ==============================================================================

-- 1. Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add Generated Spatial Geography Column to `students`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'location_point'
  ) THEN
    ALTER TABLE students 
      ADD COLUMN location_point geography(Point, 4326) 
      GENERATED ALWAYS AS (
        CASE 
          WHEN house_lat IS NOT NULL AND house_lng IS NOT NULL 
               AND house_lat >= -90.0 AND house_lat <= 90.0 
               AND house_lng >= -180.0 AND house_lng <= 180.0
          THEN ST_SetSRID(ST_MakePoint(house_lng, house_lat), 4326)::geography 
          ELSE NULL 
        END
      ) STORED;
  END IF;
END $$;

-- 3. Add Generated Spatial Geography Column to `schools`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'schools' AND column_name = 'location_point'
  ) THEN
    ALTER TABLE schools 
      ADD COLUMN location_point geography(Point, 4326) 
      GENERATED ALWAYS AS (
        CASE 
          WHEN gps_lat IS NOT NULL AND gps_lng IS NOT NULL 
               AND gps_lat >= -90.0 AND gps_lat <= 90.0 
               AND gps_lng >= -180.0 AND gps_lng <= 180.0
          THEN ST_SetSRID(ST_MakePoint(gps_lng, gps_lat), 4326)::geography 
          ELSE NULL 
        END
      ) STORED;
  END IF;
END $$;

-- 4. Add Generated Spatial Geography Column to `vehicle_active_sessions`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicle_active_sessions' AND column_name = 'location_point'
  ) THEN
    ALTER TABLE vehicle_active_sessions 
      ADD COLUMN location_point geography(Point, 4326) 
      GENERATED ALWAYS AS (
        CASE 
          WHEN current_lat IS NOT NULL AND current_lng IS NOT NULL 
               AND current_lat >= -90.0 AND current_lat <= 90.0 
               AND current_lng >= -180.0 AND current_lng <= 180.0
          THEN ST_SetSRID(ST_MakePoint(current_lng, current_lat), 4326)::geography 
          ELSE NULL 
        END
      ) STORED;
  END IF;
END $$;

-- 5. Create High-Performance GiST (R-Tree) Spatial Indexes
CREATE INDEX IF NOT EXISTS idx_students_location_gist 
  ON students USING GIST (location_point) 
  WHERE location_point IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_schools_location_gist 
  ON schools USING GIST (location_point) 
  WHERE location_point IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_active_sessions_location_gist 
  ON vehicle_active_sessions USING GIST (location_point) 
  WHERE location_point IS NOT NULL;

-- 6. Spatial RPC 1: Fast Proximity Query (Sub-millisecond index scan)
-- Returns students within radius meters (e.g. 1200m) of an escort/vehicle GPS coordinate
CREATE OR REPLACE FUNCTION get_students_within_proximity(
  p_school_id UUID,
  p_vehicle_lng DOUBLE PRECISION,
  p_vehicle_lat DOUBLE PRECISION,
  p_radius_meters DOUBLE PRECISION DEFAULT 1200.0
)
RETURNS TABLE (
  student_id UUID,
  first_name TEXT,
  last_name TEXT,
  house_address TEXT,
  house_lat NUMERIC,
  house_lng NUMERIC,
  distance_meters DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    s.id AS student_id,
    s.first_name,
    s.last_name,
    s.house_address,
    s.house_lat,
    s.house_lng,
    ROUND(ST_Distance(s.location_point, ST_SetSRID(ST_MakePoint(p_vehicle_lng, p_vehicle_lat), 4326)::geography)::numeric, 1)::double precision AS distance_meters
  FROM students s
  WHERE s.school_id = p_school_id
    AND s.location_point IS NOT NULL
    AND ST_DWithin(
      s.location_point,
      ST_SetSRID(ST_MakePoint(p_vehicle_lng, p_vehicle_lat), 4326)::geography,
      p_radius_meters
    )
  ORDER BY distance_meters ASC;
$$;

-- 7. Spatial RPC 2: Gate Geofence Verification
-- Validates if staff/student GPS is physically inside school boundary
CREATE OR REPLACE FUNCTION verify_school_geofence(
  p_school_id UUID,
  p_user_lng DOUBLE PRECISION,
  p_user_lat DOUBLE PRECISION,
  p_allowed_radius_meters DOUBLE PRECISION DEFAULT 150.0
)
RETURNS TABLE (
  is_inside BOOLEAN,
  actual_distance_meters DOUBLE PRECISION,
  school_lat NUMERIC,
  school_lng NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    ST_DWithin(
      sc.location_point,
      ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography,
      p_allowed_radius_meters
    ) AS is_inside,
    ROUND(ST_Distance(sc.location_point, ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography)::numeric, 1)::double precision AS actual_distance_meters,
    sc.gps_lat AS school_lat,
    sc.gps_lng AS school_lng
  FROM schools sc
  WHERE sc.id = p_school_id
    AND sc.location_point IS NOT NULL
  LIMIT 1;
$$;
