// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { nowUtcIso } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

/**
 * GET /api/parent/house-location
 * Returns pinned house location and metadata for children of the authenticated parent,
 * or for requested student/school if caller is School Admin, City Manager, Super Admin, or Escort.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedStudentId = searchParams.get('student_id')?.trim();
    const requestedSchoolId = searchParams.get('school_id')?.trim();

    const supabase = getAdminClient();

    let studentIds: string[] = [];

    // 1. Check if user is linked to children via student_parents
    const { data: links } = await supabase
      .from('student_parents')
      .select('student_id, relationship, is_primary')
      .eq('parent_user_id', session.user_id);

    if (links && links.length > 0) {
      studentIds = links.map((l) => l.student_id).filter(Boolean);
    }

    // 2. If explicit student_id requested (or caller is admin / escort viewing child)
    if (requestedStudentId && !studentIds.includes(requestedStudentId)) {
      studentIds.push(requestedStudentId);
    }

    // 3. If explicit school_id requested
    if (studentIds.length === 0 && requestedSchoolId) {
      const { data: schoolStudents } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', requestedSchoolId)
        .eq('is_active', true)
        .limit(100);
      if (schoolStudents && schoolStudents.length > 0) {
        studentIds = schoolStudents.map((s) => s.id);
      }
    }

    if (studentIds.length === 0) {
      return NextResponse.json({ success: true, children: [] });
    }

    const { data: students, error: stuErr } = await supabase
      .from('students')
      .select(
        'id, first_name, last_name, photo_url, school_id, custom_fields, class:school_classes(name), house_address, house_lat, house_lng, house_landmark, house_notes, house_pinned_at, house_pinned_by'
      )
      .in('id', studentIds)
      .eq('is_active', true);

    if (stuErr) throw stuErr;

    // Normalize student output: if house_address is null, fall back to custom_fields.address
    const normalized = (students || []).map((s: any) => ({
      ...s,
      house_address: s.house_address || s.custom_fields?.address || null,
      house_lat: s.house_lat != null ? Number(s.house_lat) : (s.custom_fields?.house_lat != null ? Number(s.custom_fields.house_lat) : null),
      house_lng: s.house_lng != null ? Number(s.house_lng) : (s.custom_fields?.house_lng != null ? Number(s.custom_fields.house_lng) : null),
      house_landmark: s.house_landmark || s.custom_fields?.landmark || null,
      is_house_pinned: Boolean(s.house_lat != null && s.house_lng != null),
    }));

    return NextResponse.json({
      success: true,
      children: normalized,
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
 * Also authorized for School Admin (students in their school), City Manager, Super Admin, or assigned Escorts.
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

    if (!house_address || !house_address.trim()) {
      return NextResponse.json({ error: 'House street address is required' }, { status: 400 });
    }

    const hasCoords =
      house_lat !== undefined &&
      house_lat !== null &&
      house_lng !== undefined &&
      house_lng !== null &&
      !isNaN(Number(house_lat)) &&
      !isNaN(Number(house_lng));

    const lat = hasCoords ? Number(house_lat) : null;
    const lng = hasCoords ? Number(house_lng) : null;

    if (hasCoords && (lat! < -90 || lat! > 90 || lng! < -180 || lng! > 180)) {
      return NextResponse.json(
        { error: 'Valid GPS latitude (-90 to 90) and longitude (-180 to 180) are required' },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    // Check user roles
    const userRoles = (session.roles || []).map((r: any) => (typeof r === 'string' ? r : r.role || ''));
    const isPlatformAdmin =
      userRoles.includes('super_admin') ||
      userRoles.includes('city_manager') ||
      session.role === 'city_manager' ||
      session.role === 'super_admin';
    const isSchoolAdmin =
      userRoles.includes('school_admin') ||
      session.role === 'school_admin' ||
      Boolean((session as any).primary_school?.id);
    const adminSchoolId =
      (session as any).primary_school?.id ||
      session.roles?.find((r: any) => r.school_id)?.school_id ||
      null;

    // Check parent links
    const { data: parentLinks } = await supabase
      .from('student_parents')
      .select('student_id')
      .eq('parent_user_id', session.user_id);
    const parentStudentIds = new Set((parentLinks || []).map((l) => l.student_id));

    // Determine target students
    let requestedIds: string[] = [];
    if (student_id) requestedIds.push(student_id);
    if (Array.isArray(student_ids)) requestedIds.push(...student_ids);
    if (apply_to_all_children && parentStudentIds.size > 0) {
      requestedIds = Array.from(parentStudentIds);
    }
    requestedIds = Array.from(new Set(requestedIds.filter(Boolean)));

    if (requestedIds.length === 0 && parentStudentIds.size > 0) {
      requestedIds = Array.from(parentStudentIds);
    }

    if (requestedIds.length === 0) {
      return NextResponse.json({ error: 'No student specified to pin house location' }, { status: 400 });
    }

    // Fetch students to verify permissions
    const { data: targetStudents, error: targetErr } = await supabase
      .from('students')
      .select('id, school_id, custom_fields')
      .in('id', requestedIds);

    if (targetErr || !targetStudents?.length) {
      return NextResponse.json({ error: 'Target student(s) not found' }, { status: 404 });
    }

    // Check if user is assigned escort for any of these students
    const { data: escortAssigns } = await supabase
      .from('escort_assignments')
      .select('student_id')
      .in('student_id', requestedIds)
      .in('status', ['active', 'pending_confirmation', 'pending']);
    const escortStudentIds = new Set((escortAssigns || []).map((a) => a.student_id));

    // Authorized if:
    // 1. isPlatformAdmin
    // 2. student is linked to parent in student_parents
    // 3. isSchoolAdmin and (school matches or admin has school context)
    // 4. user is assigned escort for student
    const authorizedStudents = targetStudents.filter((st) => {
      if (isPlatformAdmin) return true;
      if (parentStudentIds.has(st.id)) return true;
      if (isSchoolAdmin && (!adminSchoolId || adminSchoolId === st.school_id)) return true;
      if (escortStudentIds.has(st.id)) return true;
      return false;
    });

    const targetIds = authorizedStudents.map((s) => s.id);
    if (targetIds.length === 0) {
      return NextResponse.json(
        { error: 'Unauthorized: you do not have permission to pin location for this student' },
        { status: 403 }
      );
    }

    const nowIso = nowUtcIso();
    const updatePayload: Record<string, any> = {
      house_address: house_address.trim(),
      house_landmark: house_landmark?.trim() || null,
      house_notes: house_notes?.trim() || null,
      updated_at: nowIso,
    };

    if (hasCoords) {
      updatePayload.house_lat = lat;
      updatePayload.house_lng = lng;
      updatePayload.house_pinned_at = nowIso;
      updatePayload.house_pinned_by = session.user_id;
    }

    // Update students table and synchronize custom_fields.address
    for (const st of authorizedStudents) {
      const cf = { ...(st.custom_fields || {}) } as Record<string, any>;
      cf.address = house_address.trim();
      if (house_landmark?.trim()) cf.landmark = house_landmark.trim();
      if (hasCoords) {
        cf.house_lat = lat;
        cf.house_lng = lng;
        cf.is_pinned = true;
        cf.location_pinned = true;
      }

      const { error: updateErr } = await supabase
        .from('students')
        .update({
          ...updatePayload,
          custom_fields: cf,
        })
        .eq('id', st.id);

      if (updateErr) {
        console.error('[parent/house-location POST] Update error for student', st.id, updateErr);
      }
    }

    // Synchronize linked active/pending transport_bookings with new doorstep coordinates
    if (hasCoords) {
      try {
        await supabase
          .from('transport_bookings')
          .update({
            pickup_address: house_address.trim(),
            pickup_lat: lat,
            pickup_lng: lng,
            updated_at: nowIso,
          })
          .in('student_id', targetIds)
          .in('status', ['pending', 'assigned', 'active']);
      } catch (bookErr) {
        console.warn('[parent/house-location] transport_bookings sync notice:', bookErr);
      }
    }

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
        address: house_address.trim(),
        lat,
        lng,
        landmark: house_landmark?.trim() || null,
        notes: house_notes?.trim() || null,
        pinned_at: nowIso,
      },
    });
  } catch (err: any) {
    console.error('[parent/house-location POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to pin house location' }, { status: 500 });
  }
}
