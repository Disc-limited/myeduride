-- ==============================================================================
-- Migration 011: Shared Ride Bookings, Transport Bookings, Wallets & Reports
-- ==============================================================================

-- 1. Shared Ride Escort Offerings Table
CREATE TABLE IF NOT EXISTS shared_ride_escorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escort_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  escort_name TEXT NOT NULL,
  escort_phone TEXT,
  avatar_url TEXT,
  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  departure_time TEXT DEFAULT '07:00 AM',
  return_time TEXT DEFAULT '02:30 PM',
  vehicle_model TEXT DEFAULT 'Toyota Hiace',
  vehicle_reg TEXT DEFAULT 'LAG-1024-XY',
  available_seats INT DEFAULT 4,
  total_seats INT DEFAULT 6,
  price_per_seat NUMERIC(12, 2) DEFAULT 1700.00,
  status TEXT DEFAULT 'active', -- active, full, completed, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_ride_escorts_status ON shared_ride_escorts(status);
CREATE INDEX IF NOT EXISTS idx_shared_ride_escorts_pickup ON shared_ride_escorts(pickup_address);

-- 2. Shared Ride Bookings Table
CREATE TABLE IF NOT EXISTS shared_ride_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  escort_route_id UUID REFERENCES shared_ride_escorts(id) ON DELETE SET NULL,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  pickup_address TEXT,
  dropoff_address TEXT,
  status TEXT DEFAULT 'confirmed', -- pending, confirmed, completed, cancelled
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_ride_bookings_parent ON shared_ride_bookings(parent_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_ride_bookings_student ON shared_ride_bookings(student_id);

-- 3. Transport Bookings Table (City Manager / Emergency Dispatch / Safety Connect)
CREATE TABLE IF NOT EXISTS transport_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  parent_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'parent', -- parent, city_manager, edrive, school_admin
  pickup_address TEXT,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  requested_pickup_at TIMESTAMPTZ,
  notes TEXT,
  priority TEXT DEFAULT 'standard', -- standard, urgent, emergency
  status TEXT DEFAULT 'pending', -- pending, assigned, in_transit, completed, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_bookings_school ON transport_bookings(school_id);
CREATE INDEX IF NOT EXISTS idx_transport_bookings_parent ON transport_bookings(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_transport_bookings_status ON transport_bookings(status);

-- 4. Wallets Table
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE UNIQUE,
  balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'NGN',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);

-- 5. Audit Logs Table (Parent Attendance, Withdrawals, Referrals, Gate Overrides)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'general',
  entity_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Enable RLS
ALTER TABLE shared_ride_escorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_ride_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shared_ride_escorts' AND policyname = 'Public select for shared escorts') THEN
    CREATE POLICY "Public select for shared escorts" ON shared_ride_escorts FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shared_ride_bookings' AND policyname = 'Users can select their own bookings') THEN
    CREATE POLICY "Users can select their own bookings" ON shared_ride_bookings FOR SELECT USING (auth.uid() = parent_user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transport_bookings' AND policyname = 'Users can select their own transport bookings') THEN
    CREATE POLICY "Users can select their own transport bookings" ON transport_bookings FOR SELECT USING (auth.uid() = parent_user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallets' AND policyname = 'Users can select own wallet') THEN
    CREATE POLICY "Users can select own wallet" ON wallets FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Users can select own audit logs') THEN
    CREATE POLICY "Users can select own audit logs" ON audit_logs FOR SELECT USING (auth.uid() = actor_user_id);
  END IF;
END $$;

-- Enable Realtime for dynamic live updates
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'shared_ride_escorts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE shared_ride_escorts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'shared_ride_bookings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE shared_ride_bookings;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'transport_bookings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE transport_bookings;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'wallets') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE wallets;
  END IF;
END $$;
