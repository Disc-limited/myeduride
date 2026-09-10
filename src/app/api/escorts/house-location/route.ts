// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { nowUtcIso } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

/**
 * GET /api/escorts/house-location
 * Returns the pinned home/residential location of the authenticated escort.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = getAdminClient();

    // Look up escort application by user_id or email
    let { data: escort, error } = await supabase
      .from('escort_applications')
      .select('id, full_name, phone, email, residential_address, closest_landmark, lga, house_lat, house_lng, location_pinned_at')
      .eq('user_id', session.user_id)
      .maybeSingle();

    if (!escort && session.email) {
      const res = await supabase
        .from('escort_applications')
        .select('id, full_name, phone, email, residential_address, closest_landmark, lga, house_lat, house_lng, location_pinned_at')
        .ilike('email', session.email)
        .maybeSingle();
      escort = res.data;
    }

    // Also check user_profiles
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('address')
      .eq('id', session.user_id)
      .maybeSingle();

    const houseLat = escort?.house_lat ? Number(escort.house_lat) : null;
    const houseLng = escort?.house_lng ? Number(escort.house_lng) : null;
    const isPinned = Boolean(houseLat && houseLng);

    return NextResponse.json({
      success: true,
      escort_id: escort?.id || null,
      residential_address: escort?.residential_address || profile?.address || '',
      closest_landmark: escort?.closest_landmark || '',
      lga: escort?.lga || '',
      house_lat: houseLat,
      house_lng: houseLng,
      is_pinned: isPinned,
      location_pinned_at: escort?.location_pinned_at || null,
      google_maps_url: isPinned ? `https://www.google.com/maps?q=${houseLat},${houseLng}` : null,
    });
  } catch (err: any) {
    console.error('[escorts/house-location GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to load escort location' }, { status: 500 });
  }
}

/**
 * POST /api/escorts/house-location
 * Pins or updates the escort's residential location, landmark, and GPS coordinates.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { residential_address, closest_landmark, lga, house_lat, house_lng } = body;

    if (!residential_address?.trim() && (house_lat == null || house_lng == null)) {
      return NextResponse.json(
        { error: 'Residential address or GPS coordinates are required' },
        { status: 400 }
      );
    }

    const lat = house_lat != null && !isNaN(Number(house_lat)) ? Number(house_lat) : null;
    const lng = house_lng != null && !isNaN(Number(house_lng)) ? Number(house_lng) : null;
    const pinnedAt = nowUtcIso();

    const supabase = getAdminClient();

    // 1. Update user_profiles address
    if (residential_address?.trim()) {
      await supabase
        .from('user_profiles')
        .update({ address: residential_address.trim() })
        .eq('id', session.user_id);
    }

    // 2. Update escort_applications
    const updatePayload: Record<string, any> = {
      location_pinned_at: pinnedAt,
    };
    if (residential_address?.trim()) updatePayload.residential_address = residential_address.trim();
    if (closest_landmark?.trim()) updatePayload.closest_landmark = closest_landmark.trim();
    if (lga?.trim()) updatePayload.lga = lga.trim();
    if (lat != null) updatePayload.house_lat = lat;
    if (lng != null) updatePayload.house_lng = lng;

    let updatedEscort: any = null;

    // Try update by user_id
    const res1 = await supabase
      .from('escort_applications')
      .update(updatePayload)
      .eq('user_id', session.user_id)
      .select()
      .maybeSingle();

    if (res1.data) {
      updatedEscort = res1.data;
    } else if (session.email) {
      const res2 = await supabase
        .from('escort_applications')
        .update(updatePayload)
        .ilike('email', session.email)
        .select()
        .maybeSingle();
      updatedEscort = res2.data;
    }

    return NextResponse.json({
      success: true,
      message: 'Escort residential location successfully pinned!',
      location: {
        residential_address: updatePayload.residential_address || updatedEscort?.residential_address,
        closest_landmark: updatePayload.closest_landmark || updatedEscort?.closest_landmark,
        house_lat: lat,
        house_lng: lng,
        location_pinned_at: pinnedAt,
        google_maps_url: lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null,
      },
    });
  } catch (err: any) {
    console.error('[escorts/house-location POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save location' }, { status: 500 });
  }
}
