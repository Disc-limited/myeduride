// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { calculateHaversineDistance } from '@/lib/types/tracking-types';

export const dynamic = 'force-dynamic';

const DEFAULT_GEOFENCE_RADIUS_METERS = 200; // Standard school campus / gate perimeter

/**
 * GET /api/schools/geofence
 * Returns pinned GPS coordinates, location metadata, and geofence parameters
 * for the school. Accessible to all authorized portal roles (staff, teachers,
 * parents, escorts, gate officers, admins).
 *
 * Query Params:
 * - school_id (optional, falls back to session primary_school_id or user's assigned school)
 * - lat (optional, client device latitude to test geofence containment)
 * - lng (optional, client device longitude to test geofence containment)
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetSchoolId =
      searchParams.get('school_id') ||
      (session as any).primary_school?.id ||
      session.roles?.find((r: any) => r.school_id)?.school_id;

    if (!targetSchoolId) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data: school, error } = await supabase
      .from('schools')
      .select('id, name, address, gps_lat, gps_lng, location_address, location_landmark, location_pinned_at, location_pinned_by')
      .eq('id', targetSchoolId)
      .single();

    if (error || !school) {
      return NextResponse.json({ error: error?.message || 'School not found' }, { status: 404 });
    }

    const latVal = school.gps_lat != null ? Number(school.gps_lat) : null;
    const lngVal = school.gps_lng != null ? Number(school.gps_lng) : null;
    const isPinned = latVal != null && lngVal != null && !isNaN(latVal) && !isNaN(lngVal);

    // Optional: test a client coordinate against the school geofence
    const testLat = searchParams.get('lat') ? Number(searchParams.get('lat')) : null;
    const testLng = searchParams.get('lng') ? Number(searchParams.get('lng')) : null;

    let testResult: {
      client_lat: number;
      client_lng: number;
      distance_meters: number;
      is_inside_geofence: boolean;
      status: 'inside_geofence' | 'outside_geofence' | 'unpinned';
      summary: string;
    } | null = null;

    if (testLat != null && testLng != null && !isNaN(testLat) && !isNaN(testLng)) {
      if (!isPinned) {
        testResult = {
          client_lat: testLat,
          client_lng: testLng,
          distance_meters: -1,
          is_inside_geofence: false,
          status: 'unpinned',
          summary: 'School campus gate is not yet pinned with GPS coordinates.',
        };
      } else {
        const dist = Math.round(calculateHaversineDistance(testLat, testLng, latVal, lngVal));
        const inside = dist <= DEFAULT_GEOFENCE_RADIUS_METERS;
        testResult = {
          client_lat: testLat,
          client_lng: testLng,
          distance_meters: dist,
          is_inside_geofence: inside,
          status: inside ? 'inside_geofence' : 'outside_geofence',
          summary: inside
            ? `Inside School Geofence (${dist}m from Campus Gate)`
            : `Outside School Geofence (${dist}m away from Campus Gate; Perimeter is ${DEFAULT_GEOFENCE_RADIUS_METERS}m)`,
        };
      }
    }

    return NextResponse.json({
      success: true,
      school_id: targetSchoolId,
      school_name: school.name,
      is_pinned: isPinned,
      gps_lat: latVal,
      gps_lng: lngVal,
      address: school.location_address || school.address || '',
      landmark: school.location_landmark || '',
      pinned_at: school.location_pinned_at,
      geofence_radius_meters: DEFAULT_GEOFENCE_RADIUS_METERS,
      geofence_boundary: isPinned
        ? {
            type: 'circle',
            center: { lat: latVal, lng: lngVal },
            radius_meters: DEFAULT_GEOFENCE_RADIUS_METERS,
          }
        : null,
      test_result: testResult,
    });
  } catch (err: any) {
    console.error('[schools/geofence GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
