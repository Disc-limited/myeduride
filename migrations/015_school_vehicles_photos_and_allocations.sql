-- ============================================================
-- 015_school_vehicles_photos_and_allocations.sql
-- Enables School Admins to attach snapped vehicle photos (front, door side, license plate),
-- allocate School Escorts to buses, and assign vehicles to transport routes.
-- ============================================================

-- 1. Extend school_vehicles table with photo URLs, escort details, and route linkage
ALTER TABLE school_vehicles 
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_photos JSONB,
  ADD COLUMN IF NOT EXISTS assigned_escort_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_escort_phone TEXT,
  ADD COLUMN IF NOT EXISTS assigned_route_id UUID REFERENCES transport_routes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_route_name TEXT;

-- 2. Indexes for efficient lookup by route and escort
CREATE INDEX IF NOT EXISTS idx_school_vehicles_assigned_route 
  ON school_vehicles(assigned_route_id) 
  WHERE assigned_route_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_school_vehicles_assigned_escort 
  ON school_vehicles(assigned_escort_id) 
  WHERE assigned_escort_id IS NOT NULL;
