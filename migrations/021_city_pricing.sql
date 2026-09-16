-- Migration 021: Per-city global pricing (City Manager rate adjuster)
-- Active rates + immutable adjustment history + city-scoped pricing notices/banners

CREATE TABLE IF NOT EXISTS city_pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_key TEXT NOT NULL UNIQUE,
  city_label TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  rate_per_half_km NUMERIC(12, 2) NOT NULL DEFAULT 300,
  rate_per_tenth_km NUMERIC(12, 2) NOT NULL DEFAULT 30,
  service_charge_percent NUMERIC(6, 2) NOT NULL DEFAULT 6,
  shared_ride_base_fare_round NUMERIC(12, 2) NOT NULL DEFAULT 1500,
  shared_ride_base_fare_single NUMERIC(12, 2) NOT NULL DEFAULT 850,
  shared_ride_service_fee NUMERIC(12, 2) NOT NULL DEFAULT 100,
  version INT NOT NULL DEFAULT 1,
  -- Pending schedule (effective_from mode)
  pending_rates JSONB,
  pending_effective_from TIMESTAMPTZ,
  pending_reason TEXT,
  pending_adjustment_id UUID,
  last_reason TEXT,
  last_adjusted_at TIMESTAMPTZ,
  last_adjusted_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS city_pricing_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_key TEXT NOT NULL,
  city_label TEXT NOT NULL,
  effective_mode TEXT NOT NULL CHECK (effective_mode IN ('immediate', 'rewrite_stored', 'effective_from')),
  effective_from TIMESTAMPTZ,
  reason TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  rates_before JSONB NOT NULL,
  rates_after JSONB NOT NULL,
  version_before INT,
  version_after INT,
  author_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  author_name TEXT,
  audience_snapshot JSONB,
  rewrite_count INT DEFAULT 0,
  notification_count INT DEFAULT 0,
  notice_ids UUID[] DEFAULT ARRAY[]::UUID[],
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'scheduled', 'activated', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_city_pricing_adjustments_city
  ON city_pricing_adjustments(city_key, created_at DESC);

CREATE TABLE IF NOT EXISTS city_pricing_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_key TEXT NOT NULL,
  adjustment_id UUID REFERENCES city_pricing_adjustments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_audiences TEXT[] DEFAULT ARRAY['parents', 'school_admin', 'escorts'],
  effective_mode TEXT,
  effective_from TIMESTAMPTZ,
  rates_summary JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_city_pricing_notices_active
  ON city_pricing_notices(city_key, is_active, created_at DESC);

-- Seed default cities from current hardcoded engine rates
INSERT INTO city_pricing_config (
  city_key, city_label, currency,
  rate_per_half_km, rate_per_tenth_km, service_charge_percent,
  shared_ride_base_fare_round, shared_ride_base_fare_single, shared_ride_service_fee,
  last_reason
) VALUES
  ('LAGOS', 'Lagos (Default)', 'NGN', 300, 30, 6, 1500, 850, 100, 'Initial platform rates'),
  ('LAGOS MAINLAND', 'Lagos Mainland', 'NGN', 300, 30, 6, 1500, 850, 100, 'Initial platform rates'),
  ('LAGOS ISLAND', 'Lagos Island', 'NGN', 300, 30, 6, 1500, 850, 100, 'Initial platform rates'),
  ('IKEJA', 'Ikeja', 'NGN', 300, 30, 6, 1500, 850, 100, 'Initial platform rates'),
  ('LEKKI', 'Lekki', 'NGN', 300, 30, 6, 1500, 850, 100, 'Initial platform rates'),
  ('ABUJA', 'Abuja', 'NGN', 300, 30, 6, 1500, 850, 100, 'Initial platform rates'),
  ('EDO', 'Benin City / Edo', 'NGN', 300, 30, 6, 1500, 850, 100, 'Initial platform rates')
ON CONFLICT (city_key) DO NOTHING;

-- Allow system notification type for pricing (safe if constraint already widened)
DO $$
BEGIN
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'arrival', 'departure', 'late', 'dismissal', 'system',
      'pickup_request', 'pickup_person', 'pricing'
    ));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notifications type constraint update skipped: %', SQLERRM;
END $$;
