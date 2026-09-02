-- ==============================================================================
-- Migration: 013_school_escort_comprehensive_onboarding.sql
-- Description: Adds comprehensive bio-data, identity, and biometric fields to escort_applications table.
-- ==============================================================================

-- 1. Ensure escort_applications has all detailed onboarding and biometric columns
ALTER TABLE escort_applications
  ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'Nigerian',
  ADD COLUMN IF NOT EXISTS dob DATE,
  ADD COLUMN IF NOT EXISTS religion TEXT,
  ADD COLUMN IF NOT EXISTS blood_group TEXT,
  ADD COLUMN IF NOT EXISTS closest_landmark TEXT,
  ADD COLUMN IF NOT EXISTS residential_address TEXT,
  ADD COLUMN IF NOT EXISTS lga TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS marital_status TEXT DEFAULT 'Single',
  ADD COLUMN IF NOT EXISTS number_of_children INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photo TEXT,
  ADD COLUMN IF NOT EXISTS passport_doc_url TEXT,
  ADD COLUMN IF NOT EXISTS facial_scan_token TEXT,
  ADD COLUMN IF NOT EXISTS fingerprint_token TEXT,
  ADD COLUMN IF NOT EXISTS highest_qualification TEXT,
  ADD COLUMN IF NOT EXISTS languages_spoken TEXT,
  ADD COLUMN IF NOT EXISTS years_of_experience NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_employment TEXT,
  ADD COLUMN IF NOT EXISTS drivers_licence_number TEXT,
  ADD COLUMN IF NOT EXISTS drivers_licence_doc_url TEXT,
  ADD COLUMN IF NOT EXISTS police_clearance_doc_url TEXT,
  ADD COLUMN IF NOT EXISTS medical_fitness_doc_url TEXT,
  ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'Full-Time',
  ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES school_vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS primary_route_id UUID REFERENCES transport_routes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS primary_school_id UUID REFERENCES schools(id) ON DELETE SET NULL;

-- 2. Indexes for fast escort lookups by school and status
CREATE INDEX IF NOT EXISTS idx_escort_applications_school ON escort_applications (school_id);
CREATE INDEX IF NOT EXISTS idx_escort_applications_user ON escort_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_escort_applications_phone ON escort_applications (phone);
