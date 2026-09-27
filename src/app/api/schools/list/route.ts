import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getPlatformSchoolId } from '@/lib/auth/super-admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || !sessionHasRole(session, 'super_admin')) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const supabase = getAdminClient();
    const platformId = getPlatformSchoolId();

    const { data: allSchools, error } = await supabase
      .from('schools')
      .select('*')
      .order('name');

    if (error) {
      console.error('[schools/list]', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const schools = (allSchools || []).filter((s) => s.id !== platformId);

    const { data: studentCounts } = await supabase
      .from('students')
      .select('school_id')
      .eq('is_active', true);

    const { data: staffCounts } = await supabase
      .from('user_school_roles')
      .select('school_id')
      .in('role', ['school_admin', 'teacher', 'gate_officer', 'staff'])
      .eq('is_active', true);

    const { data: classCounts } = await supabase
      .from('school_classes')
      .select('school_id');

    // Fetch school admins
    const schoolIds = schools.map((s) => s.id);
    const { data: adminRoles } = await supabase
      .from('user_school_roles')
      .select('school_id, user_id, user_profiles(id, username, email, full_name, phone)')
      .in('school_id', schoolIds)
      .eq('role', 'school_admin')
      .eq('is_active', true);

    const adminBySchool = new Map<string, {
      admin_user_id: string;
      admin_name: string;
      admin_email: string;
      admin_phone: string;
      admin_username: string;
    }>();

    for (const r of adminRoles || []) {
      const p = Array.isArray(r.user_profiles) ? r.user_profiles[0] : (r.user_profiles as any);
      if (p && !adminBySchool.has(r.school_id)) {
        adminBySchool.set(r.school_id, {
          admin_user_id: p.id,
          admin_name: p.full_name || '',
          admin_email: p.email || '',
          admin_phone: p.phone || '',
          admin_username: p.username || '',
        });
      }
    }

    const schoolsWithStats = schools.map((school) => {
      const adminInfo = adminBySchool.get(school.id);
      return {
        ...school,
        student_count: studentCounts?.filter((s) => s.school_id === school.id).length || 0,
        staff_count: staffCounts?.filter((s) => s.school_id === school.id).length || 0,
        class_count: classCounts?.filter((c) => c.school_id === school.id).length || 0,
        admin_user_id: adminInfo?.admin_user_id || null,
        admin_name: adminInfo?.admin_name || null,
        admin_email: adminInfo?.admin_email || null,
        admin_phone: adminInfo?.admin_phone || null,
        admin_username: adminInfo?.admin_username || null,
      };
    });

    return NextResponse.json(
      { schools: schoolsWithStats, count: schoolsWithStats.length },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (err: any) {
    console.error('[schools/list] crash:', err);
    return NextResponse.json({ error: err.message || 'Failed to load schools' }, { status: 500 });
  }
}
