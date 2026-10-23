import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';

import { resolveStudentIdCardDetails } from '@/lib/id-card/resolve-student-details';

export const dynamic = 'force-dynamic';

const STAFF_ACCESS_ROLES = ['staff', 'teacher', 'gate_officer', 'school_admin'] as const;

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session || !sessionHasRole(session, 'super_admin')) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const selectedSchoolId = searchParams.get('school_id')?.trim();

  try {
    const supabase = getAdminClient();

    // 1. Fetch schools, students, staff roles, teacher profiles, and custom roles in parallel
    const [schoolsRes, studentsRes, staffRolesRes, teacherProfilesRes, customRolesRes] = await Promise.all([
      supabase
        .from('schools')
        .select('id, name, address, location_address, location_landmark, primary_color, secondary_color, principal_signature_url, logo_url')
        .order('name'),

      // Active students query (including house address, landmark, and custom fields)
      (() => {
        let q = supabase
          .from('students')
          .select('id, first_name, last_name, student_id_number, photo_url, qr_code_data, school_id, house_address, house_landmark, custom_fields, class:school_classes(id, name, grade)')
          .eq('is_active', true)
          .order('first_name');
        if (selectedSchoolId && selectedSchoolId !== 'all') {
          q = q.eq('school_id', selectedSchoolId);
        }
        return q;
      })(),

      // Active staff roles query
      (() => {
        let q = supabase
          .from('user_school_roles')
          .select('id, user_id, role, school_id, is_active, profile:user_profiles(*)')
          .in('role', [...STAFF_ACCESS_ROLES])
          .eq('is_active', true);
        if (selectedSchoolId && selectedSchoolId !== 'all') {
          q = q.eq('school_id', selectedSchoolId);
        }
        return q;
      })(),

      // Teacher profiles metadata (photos, staff_id_numbers, custom_role_id)
      (() => {
        let q = supabase
          .from('teacher_profiles')
          .select('id, user_id, school_id, staff_id_number, photo_url, qr_code_data, custom_role_id');
        if (selectedSchoolId && selectedSchoolId !== 'all') {
          q = q.eq('school_id', selectedSchoolId);
        }
        return q;
      })(),

      // School custom roles
      supabase
        .from('school_custom_roles')
        .select('id, name')
        .eq('is_active', true),
    ]);

    if (schoolsRes.error) {
      console.error('[GET /api/super-admin/id-cards] schools error:', schoolsRes.error);
      return NextResponse.json({ error: schoolsRes.error.message }, { status: 500 });
    }
    if (studentsRes.error) {
      console.error('[GET /api/super-admin/id-cards] students error:', studentsRes.error);
      return NextResponse.json({ error: studentsRes.error.message }, { status: 500 });
    }
    if (staffRolesRes.error) {
      console.error('[GET /api/super-admin/id-cards] staff roles error:', staffRolesRes.error);
      return NextResponse.json({ error: staffRolesRes.error.message }, { status: 500 });
    }

    const schoolsList = (schoolsRes.data || []).map((s: any) => ({
      ...s,
      accent_color: s.secondary_color || '#28A745',
      signature_url: s.principal_signature_url,
      has_logo: Boolean(s.logo_url),
      has_signature: Boolean(s.principal_signature_url),
    }));
    const schoolMap = new Map(schoolsList.map((s) => [s.id, s]));

    // Batch query linked parents and transport route assignments for all active students
    const studentListRaw = studentsRes.data || [];
    const studentIds = studentListRaw.map((s: any) => s.id);

    const [parentsRes, routeAssignmentsRes] = await Promise.all([
      studentIds.length > 0
        ? supabase
            .from('student_parents')
            .select('student_id, relationship, is_primary, parent:user_profiles(id, full_name, phone)')
            .in('student_id', studentIds)
        : { data: [] },
      studentIds.length > 0
        ? supabase
            .from('student_route_assignments')
            .select('student_id, morning_stop:transport_route_stops!morning_stop_id(id, name, landmark), afternoon_stop:transport_route_stops!afternoon_stop_id(id, name, landmark), morning_route:transport_routes!morning_route_id(id, name, code), afternoon_route:transport_routes!afternoon_route_id(id, name, code)')
            .in('student_id', studentIds)
        : { data: [] },
    ]);

    const parentsByStudent = new Map<string, any[]>();
    for (const link of (parentsRes.data || []) as any[]) {
      if (!parentsByStudent.has(link.student_id)) {
        parentsByStudent.set(link.student_id, []);
      }
      parentsByStudent.get(link.student_id)!.push(link);
    }

    const routeAssignmentsByStudent = new Map<string, any>();
    for (const r of (routeAssignmentsRes.data || []) as any[]) {
      routeAssignmentsByStudent.set(r.student_id, r);
    }

    // Map students with embedded school object & actual database-resolved contact & stop details
    const allStudents = studentListRaw.map((s: any) => {
      const parentLinks = parentsByStudent.get(s.id) || [];
      const routeAssignment = routeAssignmentsByStudent.get(s.id) || null;
      const resolved = resolveStudentIdCardDetails(s, parentLinks, routeAssignment);
      const schoolObj = schoolMap.get(s.school_id) || null;

      return {
        ...s,
        school: schoolObj,
        school_id: s.school_id,
        guardian_name: resolved.guardianName,
        guardian_phone: resolved.guardianPhone,
        home_stop: resolved.homeStop,
        route_code: resolved.routeCode,
        parent_links: parentLinks,
        route_assignment: routeAssignment,
      };
    });

    // Custom role mapping & teacher profile lookup map
    const customRoleMap = new Map(
      (customRolesRes.data || []).map((c: any) => [c.id, c.name])
    );
    const teacherProfileMap = new Map(
      (teacherProfilesRes.data || []).map((tp: any) => [`${tp.school_id}:${tp.user_id}`, tp])
    );

    // Map staff with embedded school & staff profile
    const allStaff = (staffRolesRes.data || []).map((r: any) => {
      const tp = teacherProfileMap.get(`${r.school_id}:${r.user_id}`);
      const schoolObj = schoolMap.get(r.school_id) || null;
      const profileObj = r.profile || {};
      const customTitle = tp?.custom_role_id ? customRoleMap.get(tp.custom_role_id) : null;
      const jobTitle = customTitle || (r.role === 'staff' ? 'Staff' : String(r.role).replace(/_/g, ' '));
      const staffIdNum = tp?.staff_id_number || `STF-${String(r.user_id || '').slice(0, 6).toUpperCase()}`;

      return {
        ...r,
        school: schoolObj,
        school_id: r.school_id,
        job_title: jobTitle,
        staff: {
          staff_id_number: staffIdNum,
          photo_url: tp?.photo_url || profileObj.avatar_url || profileObj.photo_url || null,
          qr_code_data: tp?.qr_code_data || `MYEDURIDE:STAFF:${staffIdNum}`,
        },
      };
    });

    return NextResponse.json({
      schools: schoolsList,
      students: allStudents,
      staff: allStaff,
      total_students: allStudents.length,
      total_staff: allStaff.length,
    });
  } catch (error: unknown) {
    console.error('[GET /api/super-admin/id-cards] error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load ID card data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
