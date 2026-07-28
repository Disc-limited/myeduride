import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/school-admin/parents/search
 *
 * Returns all parent profiles linked to the caller's school.
 * When `q` is provided (≥2 chars), filters by username or full_name on the DB.
 * When `q` is empty or absent, returns ALL parents in the school (for pre-loading).
 *
 * Roles allowed: school_admin, super_admin
 */
export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session?.user_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminRole = (session.roles || []).find((r) =>
    ['school_admin', 'super_admin'].includes(r.role)
  );

  if (!adminRole) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // For school admins use their scoped school; super admins may pass school_id explicitly
  const schoolIds = Array.from(
    new Set(
      (session.roles || [])
        .filter((r) => r.role === 'school_admin')
        .map((r) => r.school_id)
        .filter(Boolean)
    )
  );

  const explicitSchoolId = request.nextUrl.searchParams.get('school_id')?.trim();
  const schoolId = schoolIds[0] || explicitSchoolId || null;

  if (!schoolId) {
    return NextResponse.json({ error: 'No school context available' }, { status: 400 });
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() || '';

  try {
    const supabase = getAdminClient();

    // 1. Collect parent user IDs associated with this school via user_school_roles OR student_parents
    const [rolesRes, studentParentsRes] = await Promise.all([
      supabase
        .from('user_school_roles')
        .select('user_id')
        .eq('school_id', schoolId)
        .eq('role', 'parent'),
      supabase
        .from('student_parents')
        .select('parent_user_id, student:students!inner(school_id)')
        .eq('student.school_id', schoolId),
    ]);

    const schoolParentIds = new Set<string>();
    (rolesRes.data || []).forEach((r) => r.user_id && schoolParentIds.add(r.user_id));
    (studentParentsRes.data || []).forEach((sp) => sp.parent_user_id && schoolParentIds.add(sp.parent_user_id));

    // 2. Query user_profiles
    const sanitized = q.replace(/[,()%\\]/g, '').trim();
    let profilesData: any[] = [];

    if (sanitized.length >= 1) {
      // Direct search across all user_profiles by name, username, phone, or email
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sanitized);
      const wildQuery = `%${sanitized}%`;
      const multiWordWild = sanitized.includes(' ') ? `%${sanitized.replace(/\s+/g, '%')}%` : null;

      let orClauses = [
        `username.ilike.${wildQuery}`,
        `full_name.ilike.${wildQuery}`,
        `phone.ilike.${wildQuery}`,
        `email.ilike.${wildQuery}`,
      ];

      if (multiWordWild) {
        orClauses.push(`full_name.ilike.${multiWordWild}`);
      }

      if (isUuid) {
        orClauses.push(`id.eq.${sanitized}`);
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, full_name, email, phone')
        .or(orClauses.join(','))
        .order('full_name', { ascending: true })
        .limit(100);

      if (error) {
        console.error('[PARENT SEARCH] profile query error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      profilesData = data || [];

      // Prioritize school-linked parents first
      if (schoolParentIds.size > 0) {
        profilesData.sort((a, b) => {
          const aInSchool = schoolParentIds.has(a.id) ? 0 : 1;
          const bInSchool = schoolParentIds.has(b.id) ? 0 : 1;
          return aInSchool - bInSchool;
        });
      }
    } else {
      // When q is empty, pre-load up to 100 parents connected to this school
      if (schoolParentIds.size === 0) {
        return NextResponse.json({ parents: [], school_id: schoolId });
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, full_name, email, phone')
        .in('id', Array.from(schoolParentIds))
        .order('full_name', { ascending: true })
        .limit(100);

      if (error) {
        console.error('[PARENT SEARCH] default listing error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      profilesData = data || [];
    }

    const parents = profilesData.map((p) => ({
      id: p.id,
      username: p.username || '',
      full_name: p.full_name || p.username || 'Parent',
      email: p.email || null,
      phone: p.phone || null,
    }));

    return NextResponse.json({ parents, school_id: schoolId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Search failed';
    console.error('[PARENT SEARCH] Crash:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
