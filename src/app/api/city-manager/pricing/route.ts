import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import {
  CITY_OPTIONS,
  getActiveCityPricing,
  listActivePricingNotices,
  listCityPricingHistory,
  normalizeCityKey,
  publishCityPricing,
  type EffectiveMode,
} from '@/lib/escort/city-pricing';

export const dynamic = 'force-dynamic';

function canManagePricing(session: ReturnType<typeof getSessionFromRequest>): boolean {
  if (!session) return false;
  return (
    sessionHasRole(session, 'city_manager') ||
    sessionHasRole(session, 'super_admin')
  );
}

/**
 * GET /api/city-manager/pricing?city=LAGOS
 * Active rates + history + notices for a city.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || !canManagePricing(session)) {
      return NextResponse.json({ error: 'City Manager access required' }, { status: 403 });
    }

    const cityKey = normalizeCityKey(request.nextUrl.searchParams.get('city'));
    const config = await getActiveCityPricing(cityKey);
    const history = await listCityPricingHistory(cityKey, 25);
    const notices = await listActivePricingNotices(cityKey, 5);

    return NextResponse.json({
      success: true,
      cities: CITY_OPTIONS,
      city_key: cityKey,
      config,
      history,
      notices,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load city pricing';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/city-manager/pricing
 * Publish a city-wide rate adjustment.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || !canManagePricing(session)) {
      return NextResponse.json({ error: 'City Manager access required' }, { status: 403 });
    }

    const body = await request.json();
    const effectiveMode = String(body.effective_mode || body.effectiveMode || 'immediate') as EffectiveMode;
    if (!['immediate', 'rewrite_stored', 'effective_from'].includes(effectiveMode)) {
      return NextResponse.json(
        { error: 'effective_mode must be immediate, rewrite_stored, or effective_from' },
        { status: 400 }
      );
    }

    const result = await publishCityPricing({
      cityKey: body.city_key || body.cityKey || 'LAGOS',
      reason: body.reason,
      effectiveMode,
      effectiveFrom: body.effective_from || body.effectiveFrom || null,
      authorUserId: session.user_id,
      authorName: session.full_name || session.username,
      rates: {
        rate_per_km: body.rate_per_km ?? body.rate_per_half_km,
        rate_per_half_km: body.rate_per_km ?? body.rate_per_half_km,
        rate_per_tenth_km: 0,
        service_charge_percent: body.service_charge_percent,
        shared_ride_base_fare_round: body.shared_ride_base_fare_round,
        shared_ride_base_fare_single: body.shared_ride_base_fare_single,
        shared_ride_service_fee: body.shared_ride_service_fee,
        currency: 'NGN',
      },
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Publish failed' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message:
        effectiveMode === 'effective_from'
          ? 'Rate change scheduled. Parents, schools, and escorts have been notified.'
          : effectiveMode === 'rewrite_stored'
            ? `Rates published and ${result.rewrite_count || 0} active assignment(s) rebased. Notifications sent.`
            : 'Rates published for new quotes. Notifications sent to parents, schools, and escorts.',
      config: result.config,
      adjustment: result.adjustment,
      rewrite_count: result.rewrite_count || 0,
      notification_count: result.notification_count || 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to publish pricing';
    console.error('[city-manager/pricing POST]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
