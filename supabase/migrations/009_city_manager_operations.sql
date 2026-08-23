-- City Manager operational dispatch, booking and accountability ledger.
-- Ensure legacy deployments have the escort registry required by dispatch.
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


CREATE TABLE IF NOT EXISTS transport_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  parent_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'parent' CHECK (source IN ('parent', 'sales', 'business_development', 'city_manager', 'school')),
  pickup_address TEXT,
  pickup_lat NUMERIC,
  pickup_lng NUMERIC,
  requested_pickup_at TIMESTAMPTZ,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escort_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES transport_bookings(id) ON DELETE SET NULL,
  escort_application_id TEXT NOT NULL REFERENCES escort_applications(id) ON DELETE RESTRICT,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  assignment_type TEXT NOT NULL DEFAULT 'standard' CHECK (assignment_type IN ('standard', 'emergency', 'deputy')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'reassigned', 'cancelled')),
  assigned_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  replaces_assignment_id UUID REFERENCES escort_assignments(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS city_manager_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_bookings_status ON transport_bookings(status, requested_pickup_at);
CREATE INDEX IF NOT EXISTS idx_escort_assignments_escort ON escort_assignments(escort_application_id, status);
CREATE INDEX IF NOT EXISTS idx_escort_assignments_student ON escort_assignments(student_id, status);
CREATE INDEX IF NOT EXISTS idx_city_manager_audit_created ON city_manager_audit_log(created_at DESC);

-- Emergency shared-ride pool and dispatch confirmation.
ALTER TABLE escort_applications ADD COLUMN IF NOT EXISTS availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'on_assignment', 'offline'));
ALTER TABLE escort_applications ADD COLUMN IF NOT EXISTS emergency_pool_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE escort_applications ADD COLUMN IF NOT EXISTS last_available_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE transport_bookings ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'standard' CHECK (priority IN ('standard', 'urgent', 'emergency'));
ALTER TABLE escort_assignments ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE escort_assignments DROP CONSTRAINT IF EXISTS escort_assignments_status_check;
ALTER TABLE escort_assignments ADD CONSTRAINT escort_assignments_status_check CHECK (status IN ('pending_confirmation', 'active', 'completed', 'reassigned', 'cancelled'));
CREATE INDEX IF NOT EXISTS idx_emergency_escort_pool ON escort_applications(availability_status) WHERE emergency_pool_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_transport_bookings_priority ON transport_bookings(priority, status);
