import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/school-notices/active?school_id=xxx&user_role=xxx
 * Returns active, recent official school notices for display on user dashboards.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let schoolId = searchParams.get('school_id');
    if (!schoolId || schoolId === 'undefined' || schoolId === 'null' || schoolId.trim() === '') {
      schoolId = null;
    }

    const sessAny = session as any;
    const userRole = (searchParams.get('user_role') || sessAny.role || sessAny.roles?.[0] || '').toLowerCase();
    const userEmail = session.email || sessAny.email || null;

    const supabase = getAdminClient();

    // Fallback school_id resolution from session
    if (!schoolId) {
      schoolId = sessAny.primary_school_id || sessAny.school_id || sessAny.primary_school?.id || null;
    }

    // Exhaustive multi-table school_id lookup if missing
    if (!schoolId && (session.user_id || userEmail)) {
      // 1. Check user_profiles
      let q = supabase.from('user_profiles').select('school_id, primary_school_id');
      if (session.user_id && userEmail) {
        q = q.or(`id.eq.${session.user_id},email.eq.${userEmail}`);
      } else if (session.user_id) {
        q = q.eq('id', session.user_id);
      } else if (userEmail) {
        q = q.eq('email', userEmail);
      }
      const { data: profile } = await q.limit(1).maybeSingle();
      if (profile?.school_id || profile?.primary_school_id) {
        schoolId = profile.school_id || profile.primary_school_id;
      }
    }

    if (!schoolId && (session.user_id || userEmail)) {
      // 2. Check user_school_roles
      const { data: roleRow } = await supabase
        .from('user_school_roles')
        .select('school_id')
        .eq('user_id', session.user_id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (roleRow?.school_id) {
        schoolId = roleRow.school_id;
      }
    }

    if (!schoolId && (session.user_id || userEmail)) {
      // 3. Check staff_profiles by user_id OR email
      let sq = supabase.from('staff_profiles').select('school_id');
      if (session.user_id && userEmail) {
        sq = sq.or(`user_id.eq.${session.user_id},email.eq.${userEmail}`);
      } else if (session.user_id) {
        sq = sq.eq('user_id', session.user_id);
      } else if (userEmail) {
        sq = sq.eq('email', userEmail);
      }
      const { data: staff } = await sq.limit(1).maybeSingle();
      if (staff?.school_id) {
        schoolId = staff.school_id;
      }
    }

    if (!schoolId && (session.user_id || userEmail)) {
      // 4. Check escort_applications by user_id OR email
      let eq = supabase.from('escort_applications').select('school_id, primary_school_id');
      if (session.user_id && userEmail) {
        eq = eq.or(`user_id.eq.${session.user_id},email.eq.${userEmail}`);
      } else if (session.user_id) {
        eq = eq.eq('user_id', session.user_id);
      } else if (userEmail) {
        eq = eq.eq('email', userEmail);
      }
      const { data: escort } = await eq.limit(1).maybeSingle();
      if (escort?.school_id || escort?.primary_school_id) {
        schoolId = escort.school_id || escort.primary_school_id;
      }
    }

    if (!schoolId && session.user_id) {
      // 5. Check students for parents
      const { data: st } = await supabase
        .from('students')
        .select('school_id')
        .eq('parent_id', session.user_id)
        .limit(1)
        .maybeSingle();

      if (st?.school_id) {
        schoolId = st.school_id;
      }
    }

    let notices: any[] = [];

    if (schoolId) {
      const { data: schoolNotices, error } = await supabase
        .from('school_notices')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && schoolNotices) {
        notices = schoolNotices;
      }
    }

    // Secondary fallback: if no notices found for schoolId, fetch top active broadcast notices
    if (notices.length === 0) {
      const { data: fallbackNotices } = await supabase
        .from('school_notices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (fallbackNotices) {
        notices = fallbackNotices;
      }
    }

    // Filter by target role matching
    const filteredNotices = notices.filter((n: any) => {
      let rawTargets = n.target_audiences || [];
      if (typeof rawTargets === 'string') {
        try {
          rawTargets = JSON.parse(rawTargets);
        } catch {
          rawTargets = rawTargets.split(',').map((s: string) => s.trim());
        }
      }
      if (!Array.isArray(rawTargets)) {
        rawTargets = [String(rawTargets)];
      }

      const targets = rawTargets.map((t: any) => String(t).toLowerCase().trim());

      if (targets.length === 0 || targets.includes('all')) return true;
      if (!userRole) return true;

      const normRole = userRole.toLowerCase().trim();

      const isParent = normRole.includes('parent') || normRole.includes('guardian');
      const isStudent = normRole.includes('student');
      const isTeacher = normRole.includes('teacher') || normRole.includes('staff') || normRole.includes('instructor') || normRole.includes('admin');
      const isEscort = normRole.includes('escort') || normRole.includes('driver');
      const isGate = normRole.includes('gate') || normRole.includes('gatemanager') || normRole.includes('security');
      const isCityManager = normRole.includes('city') || normRole.includes('manager');

      if (isParent && (targets.includes('parents') || targets.includes('parent'))) return true;
      if (isStudent && (targets.includes('students') || targets.includes('student'))) return true;
      if (isTeacher && (targets.includes('teachers') || targets.includes('teacher') || targets.includes('staff'))) return true;
      if (isEscort && (targets.includes('escorts') || targets.includes('escort'))) return true;
      if (isGate && (targets.includes('gate_officers') || targets.includes('gate_officer') || targets.includes('gate'))) return true;
      if (isCityManager && (targets.includes('city_managers') || targets.includes('city_manager') || targets.includes('city'))) return true;

      return false;
    });

    return NextResponse.json(
      {
        success: true,
        school_id: schoolId,
        notices: filteredNotices,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (err: any) {
    console.error('[GET /api/school-notices/active] error:', err);
    return NextResponse.json(
      { success: true, notices: [] },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  }
}
