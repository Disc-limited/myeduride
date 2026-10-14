import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getStudentsWithinProximityWithPostGIS } from '@/lib/maps/spatial-db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/escorts/nearby-students
 * Uses PostGIS R-Tree GiST spatial indexing to return all students within radius meters
 * (default 1200m) of an escort/vehicle coordinate in sub-millisecond query time.
 *
 * Query params:
 * - school_id: Target school UUID
 * - lat: Vehicle GPS latitude
 * - lng: Vehicle GPS longitude
 * - radius: Proximity radius in meters (default 1200)
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId =
      searchParams.get('school_id') ||
      (session as any).primary_school?.id ||
      session.roles?.find((r: any) => r.school_id)?.school_id;

    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');
    const radiusStr = searchParams.get('radius') || '1200';

    if (!schoolId) {
      return NextResponse.json({ error: 'school_id parameter is required' }, { status: 400 });
    }

    if (!latStr || !lngStr) {
      return NextResponse.json(
        { error: 'lat and lng parameters are required for proximity scan' },
        { status: 400 }
      );
    }

    const lat = Number(latStr);
    const lng = Number(lngStr);
    const radius = Number(radiusStr);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius)) {
      return NextResponse.json({ error: 'Invalid numeric coordinate parameters' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const nearbyStudents = await getStudentsWithinProximityWithPostGIS(
      supabase,
      schoolId,
      lat,
      lng,
      radius
    );

    return NextResponse.json({
      success: true,
      school_id: schoolId,
      vehicle_location: { lat, lng },
      radius_meters: radius,
      students_count: nearbyStudents.length,
      students: nearbyStudents,
      spatial_engine: 'PostGIS GiST R-Tree Indexing',
    });
  } catch (err: any) {
    console.error('[nearby-students GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
