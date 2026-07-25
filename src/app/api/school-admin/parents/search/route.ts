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

    // Step 1: Get all parent user_ids for this school
    const { data: roleRows, error: roleErr } = await supabase
      .from('user_school_roles')
      .select('user_id')
      .eq('school_id', schoolId)
      .eq('role', 'parent')
      .eq('is_active', true);

    if (roleErr) {
      console.error('[PARENT SEARCH] role lookup error:', roleErr);
      return NextResponse.json({ error: roleErr.message }, { status: 500 });
    }

    const parentIds = (roleRows || []).map((r) => r.user_id).filter(Boolean);

    if (parentIds.length === 0) {
      return NextResponse.json({ parents: [] });
    }

    // Step 2: Fetch profiles for those user_ids, optionally filtered
    let query = supabase
      .from('user_profiles')
      .select('id, username, full_name, email, phone')
      .in('id', parentIds)
      .order('full_name', { ascending: true })
      .limit(100);

    if (q.length >= 2) {
      query = query.or(`username.ilike.%${q}%,full_name.ilike.%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[PARENT SEARCH] profile lookup error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const parents = (data || []).map((p) => ({
      id: p.id,
      username: p.username,
      full_name: p.full_name,
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
