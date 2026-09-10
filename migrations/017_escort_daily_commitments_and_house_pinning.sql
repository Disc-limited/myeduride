-- ============================================================
-- 017: ESCORT DAILY COMMITMENTS, HOUSE PINNING & OPERATIONS
-- Adds support for:
-- 1. Escort home/residential location pinning (house_lat, house_lng)
-- 2. Daily trip acceptance / decline commitment tracking
-- 3. Live "Ready for Pickup" status broadcasting
-- ============================================================

ALTER TABLE IF EXISTS escort_applications
  ADD COLUMN IF NOT EXISTS house_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS house_lng NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS location_pinned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS today_trip_status TEXT DEFAULT 'pending' CHECK (today_trip_status IN ('pending', 'accepted', 'declined')),
  ADD COLUMN IF NOT EXISTS today_trip_declined_reason TEXT,
  ADD COLUMN IF NOT EXISTS today_trip_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_for_pickup BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ready_for_pickup_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_escort_applications_today_trip_status ON escort_applications (today_trip_status);
CREATE INDEX IF NOT EXISTS idx_escort_applications_ready_pickup ON escort_applications (ready_for_pickup);
CREATE INDEX IF NOT EXISTS idx_escort_applications_house_coords ON escort_applications (house_lat, house_lng);

-- 4. Enable PENDING_DEPUTY_ASSIGNMENT in emergency_deputising table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'emergency_deputising') THEN
    ALTER TABLE emergency_deputising ALTER COLUMN deputy_escort_name DROP NOT NULL;
    ALTER TABLE emergency_deputising DROP CONSTRAINT IF EXISTS emergency_deputising_status_check;
    ALTER TABLE emergency_deputising ADD CONSTRAINT emergency_deputising_status_check 
      CHECK (status IN ('PENDING_DEPUTY_ASSIGNMENT', 'ACTIVE_DEPUTY', 'COMPLETED_HANDOVER', 'CANCELLED'));
  END IF;
END $$;

