import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { deduplicateSchoolParents } from '@/lib/school/deduplicate-parents';

export const dynamic = 'force-dynamic';

/**
 * POST /api/school-admin/parents/deduplicate
 *
 * Manually triggers parent account deduplication & cleanup for the caller's school.
 * Roles allowed: school_admin, super_admin
 */
export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session?.user_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const schoolIds = Array.from(
    new Set(
      (session.roles || [])
        .filter((r) => r.role === 'school_admin' || r.role === 'super_admin')
        .map((r) => r.school_id)
        .filter(Boolean)
    )
  );

  const body = await request.json().catch(() => ({}));
  const explicitSchoolId = body.school_id?.trim();
  const schoolId = schoolIds[0] || explicitSchoolId || null;

  if (!schoolId) {
    return NextResponse.json({ error: 'No school context available' }, { status: 400 });
  }

  try {
    const supabase = getAdminClient();
    const result = await deduplicateSchoolParents(supabase, schoolId);

    if (!result.success) {
      return NextResponse.json({ error: result.message || 'Deduplication failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      school_id: schoolId,
      totalMerged: result.totalMerged,
      duplicateGroupsResolved: result.duplicateGroupsResolved,
      linksUpdated: result.linksUpdated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Deduplication failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
