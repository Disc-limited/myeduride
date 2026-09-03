// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { nowUtcIso } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

/**
 * GET /api/parent/house-location
 * Returns pinned house location and metadata for all children of the authenticated parent.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = getAdminClient();

    // Query all students linked to this parent
    const { data: links, error: linkErr } = await supabase
      .from('student_parents')
      .select('student_id, relationship, is_primary')
      .eq('parent_user_id', session.user_id);

    if (linkErr) throw linkErr;
    if (!links || links.length === 0) {
      return NextResponse.json({ success: true, children: [] });
    }

    const studentIds = links.map((l) => l.student_id);

    const { data: students, error: stuErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, photo_url, school_id, class:school_classes(name), house_address, house_lat, house_lng, house_landmark, house_notes, house_pinned_at, house_pinned_by')
      .in('id', studentIds)
      .eq('is_active', true);

    if (stuErr) throw stuErr;

    return NextResponse.json({
      success: true,
      children: students || [],
      timestamp: nowUtcIso(),
    });
  } catch (err: any) {
    console.error('[parent/house-location GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to load house locations' }, { status: 500 });
  }
}

/**
 * POST /api/parent/house-location
 * Pins house location for child or all children of the parent.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const {
      student_id,
      student_ids,
      apply_to_all_children,
      house_address,
      house_lat,
      house_lng,
      house_landmark,
      house_notes,
    } = body;

    // Validate coordinates
    const lat = Number(house_lat);
    const lng = Number(house_lng);

    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: 'Valid GPS latitude (-90 to 90) and longitude (-180 to 180) are required' },
        { status: 400 }
      );
    }

    if (!house_address || !house_address.trim()) {
      return NextResponse.json({ error: 'House street address is required' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Verify parent's linked students
    const { data: parentLinks, error: linksErr } = await supabase
      .from('student_parents')
      .select('student_id')
      .eq('parent_user_id', session.user_id);

    if (linksErr) throw linksErr;
    const authorizedStudentIds = new Set((parentLinks || []).map((l) => l.student_id));

    if (authorizedStudentIds.size === 0) {
      return NextResponse.json({ error: 'No children linked to this parent account' }, { status: 403 });
    }

    // Determine target student IDs
    let targetIds: string[] = [];
    if (apply_to_all_children) {
      targetIds = Array.from(authorizedStudentIds);
    } else if (Array.isArray(student_ids) && student_ids.length > 0) {
      targetIds = student_ids.filter((id) => authorizedStudentIds.has(id));
    } else if (student_id && authorizedStudentIds.has(student_id)) {
      targetIds = [student_id];
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ error: 'Unauthorized: target student not linked to this parent' }, { status: 403 });
    }

    const nowIso = nowUtcIso();
    const updatePayload = {
      house_address: house_address.trim(),
      house_lat: lat,
      house_lng: lng,
      house_landmark: house_landmark?.trim() || null,
      house_notes: house_notes?.trim() || null,
      house_pinned_at: nowIso,
      house_pinned_by: session.user_id,
      updated_at: nowIso,
    };

    const { error: updateErr } = await supabase
      .from('students')
      .update(updatePayload)
      .in('id', targetIds);

    if (updateErr) throw updateErr;

    // Log to audit_logs
    try {
      await supabase.from('audit_logs').insert({
        user_id: session.user_id,
        action: 'PIN_CHILD_HOUSE_LOCATION',
        resource: 'students',
        details: {
          updated_count: targetIds.length,
          student_ids: targetIds,
          address: house_address,
          lat,
          lng,
          landmark: house_landmark,
        },
      });
    } catch (auditErr) {
      console.warn('[parent/house-location] Audit log notice:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `House pickup location successfully pinned for ${targetIds.length} child/children.`,
      target_students_count: targetIds.length,
      location: {
        address: house_address,
        lat,
        lng,
        landmark: house_landmark,
        notes: house_notes,
        pinned_at: nowIso,
      },
    });
  } catch (err: any) {
    console.error('[parent/house-location POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to pin house location' }, { status: 500 });
  }
}
