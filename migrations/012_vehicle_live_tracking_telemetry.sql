-- ==============================================================================
-- Migration 012: Real-Time Vehicle & Escort GPS Tracking Architecture
-- ==============================================================================

-- 1. Active Trip Telemetry Sessions (Current Live State for Shuttles & Escorts)
CREATE TABLE IF NOT EXISTS vehicle_active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES school_vehicles(id) ON DELETE SET NULL,
  route_id UUID REFERENCES transport_routes(id) ON DELETE SET NULL,
  escort_id TEXT REFERENCES escort_applications(id) ON DELETE SET NULL,
  escort_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  trip_type TEXT NOT NULL DEFAULT 'morning_pickup' CHECK (trip_type IN ('morning_pickup', 'afternoon_dropoff', 'shared_ride', 'special_event')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('scheduled', 'in_progress', 'paused', 'completed', 'cancelled')),
  current_lat NUMERIC(10, 7),
  current_lng NUMERIC(10, 7),
  current_speed_kmh NUMERIC(5, 2) DEFAULT 0,
  current_heading NUMERIC(5, 2) DEFAULT 0,
  current_stop_index INT DEFAULT 0,
  battery_level INT,
  gps_accuracy_meters NUMERIC(5, 2),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_ping_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Historical Breadcrumb Logs (Playback, Route Optimization & Incident Audit)
CREATE TABLE IF NOT EXISTS vehicle_telemetry_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES vehicle_active_sessions(id) ON DELETE CASCADE,
  lat NUMERIC(10, 7) NOT NULL,
  lng NUMERIC(10, 7) NOT NULL,
  speed_kmh NUMERIC(5, 2) DEFAULT 0,
  heading NUMERIC(5, 2) DEFAULT 0,
  accuracy_meters NUMERIC(5, 2),
  battery_level INT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_session_time ON vehicle_telemetry_logs(session_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_active_sessions_school_status ON vehicle_active_sessions(school_id, status);
CREATE INDEX IF NOT EXISTS idx_active_sessions_vehicle ON vehicle_active_sessions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_escort ON vehicle_active_sessions(escort_id);

-- 3. Enable Supabase Realtime for Active Sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'vehicle_active_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE vehicle_active_sessions;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL; -- Publication doesn't exist in local/mock environments
END $$;
