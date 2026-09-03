// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAuthorizedSchoolAdmin } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { nowUtcIso } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

/**
 * GET /api/school-admin/location
 * Returns current pinned GPS coordinates and location metadata for the school.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const primarySchoolId =
      searchParams.get('school_id') ||
      (session as any).primary_school?.id ||
      session.roles?.find((r: any) => r.school_id)?.school_id;

    if (!primarySchoolId) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data: school, error } = await supabase
      .from('schools')
      .select('id, name, address, gps_lat, gps_lng, location_address, location_landmark, location_pinned_at, location_pinned_by')
      .eq('id', primarySchoolId)
      .single();

    if (error || !school) {
      return NextResponse.json({ error: error?.message || 'School not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      school_id: primarySchoolId,
      location: {
        gps_lat: school.gps_lat,
        gps_lng: school.gps_lng,
        address: school.location_address || school.address || '',
        landmark: school.location_landmark || '',
        pinned_at: school.location_pinned_at,
        is_pinned: school.gps_lat != null && school.gps_lng != null,
      },
    });
  } catch (err: any) {
    console.error('[school-admin/location GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/school-admin/location
 * Pins School Campus / Main Gate GPS coordinates and location metadata.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { school_id, gps_lat, gps_lng, address, landmark } = body;

    const targetSchoolId =
      school_id ||
      (session as any).primary_school?.id ||
      session.roles?.find((r: any) => r.school_id)?.school_id;

    if (!targetSchoolId) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }

    if (!isAuthorizedSchoolAdmin(session, targetSchoolId)) {
      return NextResponse.json({ error: 'Unauthorized to update this school location' }, { status: 403 });
    }

    const lat = Number(gps_lat);
    const lng = Number(gps_lng);

    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: 'Valid GPS latitude (-90 to 90) and longitude (-180 to 180) are required' },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();
    const nowIso = nowUtcIso();

    const updatePayload = {
      gps_lat: lat,
      gps_lng: lng,
      location_address: address?.trim() || null,
      location_landmark: landmark?.trim() || null,
      location_pinned_at: nowIso,
      location_pinned_by: session.user_id,
      updated_at: nowIso,
    };

    if (address?.trim()) {
      updatePayload.address = address.trim();
    }

    const { data: updatedSchool, error: updateError } = await supabase
      .from('schools')
      .update(updatePayload)
      .eq('id', targetSchoolId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log to audit_logs
    try {
      await supabase.from('audit_logs').insert({
        school_id: targetSchoolId,
        user_id: session.user_id,
        action: 'PIN_SCHOOL_CAMPUS_LOCATION',
        resource: 'schools',
        details: {
          school_id: targetSchoolId,
          gps_lat: lat,
          gps_lng: lng,
          address: address || updatedSchool.address,
          landmark,
        },
      });
    } catch (auditErr) {
      console.warn('[school-admin/location] Audit log notice:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: 'School campus gate location pinned successfully.',
      location: {
        gps_lat: updatedSchool.gps_lat,
        gps_lng: updatedSchool.gps_lng,
        address: updatedSchool.location_address || updatedSchool.address,
        landmark: updatedSchool.location_landmark,
        pinned_at: updatedSchool.location_pinned_at,
        is_pinned: true,
      },
    });
  } catch (err: any) {
    console.error('[school-admin/location POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to pin school location' }, { status: 500 });
  }
}
