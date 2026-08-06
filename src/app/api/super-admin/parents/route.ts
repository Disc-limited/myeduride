import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { getUnifiedSchoolParentsSummary } from '@/lib/school/school-parents-list';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session || !sessionHasRole(session, 'super_admin')) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const selectedSchoolId = searchParams.get('school_id');

  try {
    const supabase = getAdminClient();

    // Fetch all schools for dropdown filter & metadata
    const { data: schools, error: schoolsErr } = await supabase
      .from('schools')
      .select('id, name, address')
      .order('name');

    if (schoolsErr) {
      return NextResponse.json({ error: schoolsErr.message }, { status: 500 });
    }

    const schoolsList = schools || [];
    const targetSchools = selectedSchoolId && selectedSchoolId !== 'all'
      ? schoolsList.filter((s) => s.id === selectedSchoolId)
      : schoolsList;

    let allParents: any[] = [];

    for (const school of targetSchools) {
      const summary = await getUnifiedSchoolParentsSummary(supabase, school.id, { autoDeduplicate: false });
      const parentsWithSchool = summary.parents.map((p) => ({
        ...p,
        school_id: school.id,
        school_name: school.name,
      }));
      allParents = allParents.concat(parentsWithSchool);
    }

    const withLoginCount = allParents.filter((p) => p.has_login).length;

    return NextResponse.json({
      schools: schoolsList,
      parents: allParents,
      total: allParents.length,
      with_login: withLoginCount,
      no_login: allParents.length - withLoginCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load parents data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
