-- Migration 008: Escort Applications table & Unique Email constraint
CREATE TABLE IF NOT EXISTS escort_applications (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  escort_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  nin TEXT,
  reg_number TEXT,
  vehicle_type TEXT,
  city TEXT DEFAULT 'Lagos',
  state TEXT DEFAULT 'Lagos',
  operating_area TEXT,
  status TEXT DEFAULT 'PENDING_CITY_MANAGER_REVIEW',
  application_data JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique index on lower(email) to enforce email uniqueness across escort applications
CREATE UNIQUE INDEX IF NOT EXISTS idx_escort_applications_lower_email
  ON escort_applications (LOWER(TRIM(email)));

-- Unique index on lower(reg_number) for vehicle registration plate numbers if present
CREATE UNIQUE INDEX IF NOT EXISTS idx_escort_applications_lower_reg_number
  ON escort_applications (LOWER(TRIM(reg_number)))
  WHERE reg_number IS NOT NULL AND reg_number != '';
