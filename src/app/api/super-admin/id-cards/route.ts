import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';

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

      // Active students query
      (() => {
        let q = supabase
          .from('students')
          .select('id, first_name, last_name, student_id_number, photo_url, qr_code_data, school_id, class:school_classes(id, name, grade)')
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
    }));
    const schoolMap = new Map(schoolsList.map((s) => [s.id, s]));

    // Map students with embedded school object
    const allStudents = (studentsRes.data || []).map((s: any) => ({
      ...s,
      school: schoolMap.get(s.school_id) || null,
      school_id: s.school_id,
    }));

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
