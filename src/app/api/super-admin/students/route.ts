import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';

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

    // Fetch list of all schools for filtering dropdown
    const { data: schools, error: schoolsErr } = await supabase
      .from('schools')
      .select('id, name, address')
      .order('name');

    if (schoolsErr) {
      return NextResponse.json({ error: schoolsErr.message }, { status: 500 });
    }

    // Query students with class details & school information
    let studentsQuery = supabase
      .from('students')
      .select('*, class:school_classes(id, name, grade), school:schools(id, name)')
      .eq('is_active', true)
      .order('first_name', { ascending: fontAscending() });

    if (selectedSchoolId && selectedSchoolId !== 'all') {
      studentsQuery = studentsQuery.eq('school_id', selectedSchoolId);
    }

    const { data: students, error: studentsErr } = await studentsQuery;

    if (studentsErr) {
      return NextResponse.json({ error: studentsErr.message }, { status: 500 });
    }

    // Fetch classes for dropdown filter
    let classesQuery = supabase.from('school_classes').select('id, name, grade, school_id');
    if (selectedSchoolId && selectedSchoolId !== 'all') {
      classesQuery = classesQuery.eq('school_id', selectedSchoolId);
    }
    const { data: classes } = await classesQuery;

    const studentList = students || [];

    return NextResponse.json({
      schools: schools || [],
      classes: classes || [],
      students: studentList,
      total: studentList.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load students data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function fontAscending() {
  return true;
}
