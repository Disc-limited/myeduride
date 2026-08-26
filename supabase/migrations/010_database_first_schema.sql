-- ============================================================================
-- Migration 010: Database-First Schema & Infrastructure
-- Production tables for Fleet Vehicles, Transport Routes, Corridor Stops,
-- Student Route Linkages, Gate Visitors, Emergency Deputising, and Pickup Authorizations.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SCHOOL TRANSPORT FLEET VEHICLES
CREATE TABLE IF NOT EXISTS school_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  reg_number TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  type TEXT DEFAULT 'School Bus',
  color TEXT,
  capacity INT DEFAULT 18,
  assigned_escort_id TEXT REFERENCES escort_applications(id) ON DELETE SET NULL,
  assigned_driver_name TEXT,
  assigned_driver_phone TEXT,
  assigned_driver_license TEXT,
  roadworthiness_expiry DATE,
  insurance_status TEXT DEFAULT 'Active (Gold Shield)',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_vehicles_school ON school_vehicles(school_id, status);

-- 2. TRANSPORT ROUTES
CREATE TABLE IF NOT EXISTS transport_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  assigned_vehicle_id UUID REFERENCES school_vehicles(id) ON DELETE SET NULL,
  assigned_escort_id TEXT REFERENCES escort_applications(id) ON DELETE SET NULL,
  departure_morning TIME DEFAULT '06:45',
  departure_afternoon TIME DEFAULT '15:15',
  directions_summary TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_routes_school ON transport_routes(school_id, status);

-- 3. TRANSPORT ROUTE STOPS
CREATE TABLE IF NOT EXISTS transport_route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  stop_number INT NOT NULL,
  name TEXT NOT NULL,
  landmark TEXT,
  eta_morning TIME,
  eta_afternoon TIME,
  gps_lat NUMERIC,
  gps_lng NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_route_stops_route ON transport_route_stops(route_id, stop_number);

-- 4. STUDENT ROUTE ASSIGNMENTS
CREATE TABLE IF NOT EXISTS student_route_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  morning_route_id UUID REFERENCES transport_routes(id) ON DELETE SET NULL,
  morning_stop_id UUID REFERENCES transport_route_stops(id) ON DELETE SET NULL,
  afternoon_route_id UUID REFERENCES transport_routes(id) ON DELETE SET NULL,
  afternoon_stop_id UUID REFERENCES transport_route_stops(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_route_assignments_student ON student_route_assignments(student_id);

-- 5. GATE VISITORS & DIGITAL PASSES
CREATE TABLE IF NOT EXISTS gate_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  digital_pass_token TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  purpose_of_visit TEXT NOT NULL,
  person_to_see TEXT NOT NULL,
  department TEXT,
  vehicle_plate TEXT,
  visitor_type TEXT DEFAULT 'Parent / Guardian',
  entry_time TIMESTAMPTZ DEFAULT NOW(),
  exit_time TIMESTAMPTZ,
  duration_minutes INT,
  status TEXT DEFAULT 'on_campus' CHECK (status IN ('on_campus', 'departed', 'flagged')),
  registered_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  security_flag TEXT DEFAULT 'cleared' CHECK (security_flag IN ('cleared', 'restricted', 'flagged')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gate_visitors_school_date ON gate_visitors(school_id, entry_time DESC);

-- 6. EMERGENCY DEPUTISING & CUSTODY LEDGER
CREATE TABLE IF NOT EXISTS emergency_deputising (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  route_id UUID REFERENCES transport_routes(id) ON DELETE SET NULL,
  original_escort_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  original_escort_name TEXT,
  original_escort_phone TEXT,
  deputy_escort_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  deputy_escort_application_id TEXT REFERENCES escort_applications(id) ON DELETE SET NULL,
  deputy_escort_name TEXT NOT NULL,
  deputy_escort_phone TEXT,
  deputy_vehicle_plate TEXT,
  deputy_photo_url TEXT,
  emergency_reason TEXT NOT NULL,
  notes TEXT,
  student_ids UUID[] DEFAULT '{}',
  student_names TEXT[] DEFAULT '{}',
  time_window_start TIMESTAMPTZ DEFAULT NOW(),
  time_window_end TIMESTAMPTZ,
  handover_confirmed_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  assigned_by_name TEXT,
  status TEXT DEFAULT 'ACTIVE_DEPUTY' CHECK (status IN ('ACTIVE_DEPUTY', 'COMPLETED_HANDOVER', 'CANCELLED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_deputising_school ON emergency_deputising(school_id, status);

-- 7. 3-SLOT VERIFIED PICKUP AUTHORIZATIONS
CREATE TABLE IF NOT EXISTS pickup_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  slot_number INT NOT NULL CHECK (slot_number IN (1, 2, 3)),
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('family_member', 'escort', 'other_approved')),
  category_label TEXT,
  phone TEXT NOT NULL,
  photo_url TEXT,
  emergency_notes TEXT,
  is_verified BOOLEAN DEFAULT TRUE,
  confirmed_by_parent BOOLEAN DEFAULT TRUE,
  confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  gate_synced BOOLEAN DEFAULT TRUE,
  synced_to_gate_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, slot_number)
);

CREATE INDEX IF NOT EXISTS idx_pickup_authorizations_student ON pickup_authorizations(student_id, slot_number);
