-- Migration 022: Per-km fare formula (₦500/km + 6% service; complete = one-way × 2)
-- Adds rate_per_km and updates city defaults from the old half-km/tenth-km model.

ALTER TABLE city_pricing_config
  ADD COLUMN IF NOT EXISTS rate_per_km NUMERIC(12, 2);

-- Backfill: treat old platform default 300 as the new ₦500/km default;
-- keep any CM-custom rate_per_half_km values as the new per-km rate.
UPDATE city_pricing_config
SET
  rate_per_km = CASE
    WHEN rate_per_half_km IS NULL OR rate_per_half_km = 300 THEN 500
    ELSE rate_per_half_km
  END,
  rate_per_half_km = CASE
    WHEN rate_per_half_km IS NULL OR rate_per_half_km = 300 THEN 500
    ELSE rate_per_half_km
  END,
  rate_per_tenth_km = 0,
  service_charge_percent = COALESCE(service_charge_percent, 6),
  last_reason = COALESCE(
    last_reason,
    'Formula update: ₦500 per 0–1 km + 6% service; complete trip = one-way × 2'
  ),
  updated_at = NOW()
WHERE rate_per_km IS NULL OR rate_per_half_km = 300 OR rate_per_tenth_km = 30;

ALTER TABLE city_pricing_config
  ALTER COLUMN rate_per_km SET DEFAULT 500;

COMMENT ON COLUMN city_pricing_config.rate_per_km IS
  'NGN base per whole-km band (0-1km, 1-2km, ...). One-way = base + service%; complete = one-way x 2.';
