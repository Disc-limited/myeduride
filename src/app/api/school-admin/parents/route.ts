import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { getUnifiedSchoolParentsSummary } from '@/lib/school/school-parents-list';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session?.user_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const schoolIds = Array.from(
    new Set(
      (session.roles || [])
        .filter((r) => r.role === 'school_admin')
        .map((r) => r.school_id)
        .filter(Boolean)
    )
  );

  if (schoolIds.length === 0) {
    return NextResponse.json({ error: 'School admin access required' }, { status: 403 });
  }

  const schoolId = schoolIds[0];

  try {
    const supabase = getAdminClient();
    const summary = await getUnifiedSchoolParentsSummary(supabase, schoolId, { autoDeduplicate: true });

    return NextResponse.json({
      school_id: schoolId,
      parents: summary.parents,
      total: summary.total,
      with_login: summary.with_login,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load parents';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
