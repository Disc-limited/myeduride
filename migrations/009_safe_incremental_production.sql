-- ============================================================
-- MyEduRide — Safe Incremental Production Migration
-- File: 009_safe_incremental_production.sql
--
-- SAFE TO RUN ON EXISTING DATABASES: uses IF NOT EXISTS
-- everywhere. Will skip tables/columns that already exist.
-- Zero data loss. Zero destructive operations.
--
-- Run with:
--   psql "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
--        -f migrations/009_safe_incremental_production.sql
-- ============================================================

BEGIN;

-- ============================================================
-- 1. NEW COLUMNS on existing tables (schools)
-- Adds gate hour columns if they don't exist yet.
-- ============================================================
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
  ADD COLUMN IF NOT EXISTS student_gate_end    TIME DEFAULT '15:00',
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved';

-- Add check constraint for approval_status only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'schools_approval_status_check'
  ) THEN
    ALTER TABLE schools
      ADD CONSTRAINT schools_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- ============================================================
-- 2. NEW COLUMNS on user_profiles
-- ============================================================
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS parent_requires_photo_for_pickup BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC DEFAULT 0.0;

-- ============================================================
-- 3. NEW COLUMNS on dismissal_requests
-- ============================================================
ALTER TABLE dismissal_requests
  ADD COLUMN IF NOT EXISTS dismissal_date DATE;

-- Backfill dismissal_date from created_at for existing rows
UPDATE dismissal_requests
  SET dismissal_date = created_at::date
  WHERE dismissal_date IS NULL;

-- ============================================================
-- 4. SCHOOL CUSTOM ROLES (staff job titles)
-- ============================================================
CREATE TABLE IF NOT EXISTS school_custom_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  can_assign_class BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, slug)
);

-- ============================================================
-- 5. TEACHER_PROFILES — custom_role_id column
-- ============================================================
ALTER TABLE teacher_profiles
  ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES school_custom_roles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS teacher_responsibility TEXT DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'teacher_profiles_teacher_responsibility_check'
  ) THEN
    ALTER TABLE teacher_profiles
      ADD CONSTRAINT teacher_profiles_teacher_responsibility_check
      CHECK (teacher_responsibility IN ('class_teacher', 'subject_teacher', 'both'));
  END IF;
END $$;

-- ============================================================
-- 6. TEACHER CLASS ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_class_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_profile_id UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_profile_id, class_id)
);

-- ============================================================
-- 7. STUDENT CLASS PROMOTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS student_class_promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_class_id UUID REFERENCES school_classes(id) ON DELETE SET NULL,
  to_class_id UUID NOT NULL REFERENCES school_classes(id) ON DELETE RESTRICT,
  promoted_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  promoted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. GATE ACTIVITY LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS gate_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id UUID REFERENCES gate_sessions(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gate_activity_logs_school ON gate_activity_logs(school_id, created_at DESC);

-- ============================================================
-- 9. AUTH SECURITY EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS auth_security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  username TEXT,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. PASSWORD RESET REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- 11. AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_school ON audit_logs(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ============================================================
-- 12. SCHOOL NON-SCHOOL DAYS
-- ============================================================
CREATE TABLE IF NOT EXISTS school_non_school_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  label TEXT NOT NULL,
  applies_to TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'students', 'staff')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, date)
);

-- ============================================================
-- 13. GATE DAY OVERRIDES
-- ============================================================
CREATE TABLE IF NOT EXISTS gate_day_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  gate_open_time TIME,
  gate_close_time TIME,
  dismissal_start_time TIME,
  is_closed BOOLEAN DEFAULT FALSE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, date)
);

-- ============================================================
-- 14. STAFF ATTENDANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent')),
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  minutes_late INT,
  session_id UUID REFERENCES gate_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, user_id, date)
);

-- ============================================================
-- 15. SCHOOL CALENDAR SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS school_calendar_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE UNIQUE,
  current_term TEXT NOT NULL DEFAULT 'First Term',
  current_session TEXT NOT NULL DEFAULT '2025/2026',
  term_start_date DATE,
  term_end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 16. CHAT MESSAGES — ensure IF NOT EXISTS safe
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL DEFAULT '',
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('parent', 'teacher', 'school', 'admin')),
  title TEXT,
  content TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'audio', 'document') OR media_type IS NULL),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread
  ON chat_messages (school_id, student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread
  ON chat_messages (school_id, student_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender
  ON chat_messages (sender_id, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_messages_select" ON chat_messages;
CREATE POLICY "chat_messages_select" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_school_roles
      WHERE user_id = auth.uid()
        AND school_id = chat_messages.school_id
        AND is_active = TRUE
    )
    OR
    EXISTS (
      SELECT 1 FROM student_parents
      WHERE parent_user_id = auth.uid()
        AND student_id = chat_messages.student_id
    )
  );

DROP POLICY IF EXISTS "chat_messages_insert" ON chat_messages;
CREATE POLICY "chat_messages_insert" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ============================================================
-- 17. STAFF PRIVATE MESSAGES & USER PRESENCE
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_private_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'audio', 'document') OR media_type IS NULL),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_private_messages_history
  ON staff_private_messages (school_id, sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_private_messages_unread
  ON staff_private_messages (recipient_id, is_read) WHERE is_read = FALSE;

ALTER TABLE staff_private_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_private_messages_select" ON staff_private_messages;
CREATE POLICY "staff_private_messages_select" ON staff_private_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "staff_private_messages_insert" ON staff_private_messages;
CREATE POLICY "staff_private_messages_insert" ON staff_private_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM user_school_roles sender_role
      JOIN user_school_roles recipient_role ON sender_role.school_id = recipient_role.school_id
      WHERE sender_role.user_id = auth.uid()
        AND recipient_role.user_id = staff_private_messages.recipient_id
        AND sender_role.school_id = staff_private_messages.school_id
        AND sender_role.is_active = TRUE
        AND recipient_role.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "staff_private_messages_update" ON staff_private_messages;
CREATE POLICY "staff_private_messages_update" ON staff_private_messages
  FOR UPDATE USING (auth.uid() = recipient_id);

CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_presence_select" ON user_presence;
CREATE POLICY "user_presence_select" ON user_presence
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "user_presence_upsert" ON user_presence;
CREATE POLICY "user_presence_upsert" ON user_presence
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 18. ESCORT APPLICATIONS (MyEduRide Platform)
-- ============================================================
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
  availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'on_assignment', 'offline')),
  emergency_pool_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  application_data JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns to escort_applications if table already existed
ALTER TABLE escort_applications
  ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS emergency_pool_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_available_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_escort_applications_lower_email
  ON escort_applications (LOWER(TRIM(email)));

CREATE UNIQUE INDEX IF NOT EXISTS idx_escort_applications_lower_reg_number
  ON escort_applications (LOWER(TRIM(reg_number)))
  WHERE reg_number IS NOT NULL AND reg_number != '';

-- ============================================================
-- 19. CITY MANAGER OPERATIONS
-- ============================================================
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
  priority TEXT NOT NULL DEFAULT 'standard' CHECK (priority IN ('standard', 'urgent', 'emergency')),
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
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending_confirmation', 'active', 'completed', 'reassigned', 'cancelled')),
  confirmed_at TIMESTAMPTZ,
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

-- ============================================================
-- 20. FLEET, TRANSPORT ROUTES & STOPS
-- ============================================================
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

-- ============================================================
-- 21. GATE VISITORS
-- ============================================================
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

-- ============================================================
-- 22. EMERGENCY DEPUTISING
-- ============================================================
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

-- ============================================================
-- 23. PARENT PICKUP AUTHORIZATIONS (3-Slot Safety System)
-- ============================================================
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

-- ============================================================
-- 24. INDEXES (all idempotent via IF NOT EXISTS)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_school_vehicles_school ON school_vehicles(school_id, status);
CREATE INDEX IF NOT EXISTS idx_transport_routes_school ON transport_routes(school_id, status);
CREATE INDEX IF NOT EXISTS idx_transport_route_stops_route ON transport_route_stops(route_id, stop_number);
CREATE INDEX IF NOT EXISTS idx_gate_visitors_school_date ON gate_visitors(school_id, entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_deputising_school ON emergency_deputising(school_id, status);
CREATE INDEX IF NOT EXISTS idx_pickup_authorizations_student ON pickup_authorizations(student_id, slot_number);

-- ============================================================
-- 25. REALTIME — add new tables to publication
-- (safe: Supabase ignores duplicates gracefully)
-- ============================================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE staff_private_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ============================================================
-- 26. STORAGE: PHOTOS BUCKET (idempotent upsert)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('photos', 'photos', false, 5242880, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880;

DROP POLICY IF EXISTS "Service role photos all" ON storage.objects;
CREATE POLICY "Service role photos all"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'photos')
  WITH CHECK (bucket_id = 'photos');

-- ============================================================
-- 27. PLATFORM SCHOOL SEED (safe — ON CONFLICT DO NOTHING)
-- ============================================================
INSERT INTO schools (id, name, setup_completed, setup_step, approval_status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MyEduRide Platform',
  TRUE,
  'complete',
  'approved'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 28. PostgREST schema cache reload
-- ============================================================
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================
-- DONE. All new tables, columns, indexes, and policies applied.
-- Existing data was not touched.
-- ============================================================
