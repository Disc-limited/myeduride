import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import {
  CITY_OPTIONS,
  getActiveCityPricing,
  listActivePricingNotices,
  listCityPricingHistory,
  normalizeCityKey,
} from '@/lib/escort/city-pricing';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pricing/active?city=LAGOS
 * Read-only city rates + latest adjustment reason/banner for all portals.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const cityKey = normalizeCityKey(request.nextUrl.searchParams.get('city'));
    const config = await getActiveCityPricing(cityKey);
    const notices = await listActivePricingNotices(cityKey, 3);
    const history = await listCityPricingHistory(cityKey, 5);

    return NextResponse.json({
      success: true,
      cities: CITY_OPTIONS,
      city_key: cityKey,
      pricing: {
        city_key: config.city_key,
        city_label: config.city_label,
        currency: config.currency,
        rate_per_km: config.rate_per_km,
        rate_per_half_km: config.rate_per_km,
        rate_per_tenth_km: 0,
        service_charge_percent: config.service_charge_percent,
        shared_ride_base_fare_round: config.shared_ride_base_fare_round,
        shared_ride_base_fare_single: config.shared_ride_base_fare_single,
        shared_ride_service_fee: config.shared_ride_service_fee,
        version: config.version,
        last_reason: config.last_reason,
        last_adjusted_at: config.last_adjusted_at,
        pending_effective_from: config.pending_effective_from,
        pending_reason: config.pending_reason,
        pending_rates: config.pending_rates,
        formula: 'One-Way = Base + 6% service; Complete trip = One-Way × 2; Base = ₦/km × each 0–1 km band',
      },
      notices,
      recent_adjustments: history,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load pricing';
    // Graceful empty when migration not applied yet
    if (/city_pricing|relation|does not exist/i.test(message)) {
      return NextResponse.json({
        success: true,
        city_key: 'LAGOS',
        pricing: {
          city_key: 'LAGOS',
          city_label: 'Lagos (Default)',
          currency: 'NGN',
          rate_per_km: 500,
          rate_per_half_km: 500,
          rate_per_tenth_km: 0,
          service_charge_percent: 6,
          shared_ride_base_fare_round: 1500,
          shared_ride_base_fare_single: 850,
          shared_ride_service_fee: 100,
          version: 1,
          last_reason: 'Default: ₦500/km + 6% service; complete trip = one-way × 2',
          last_adjusted_at: null,
          pending_effective_from: null,
          pending_reason: null,
          pending_rates: null,
        },
        notices: [],
        recent_adjustments: [],
        migration_required: true,
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
