import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session?.user_id) {
    return NextResponse.json({ error: 'Unauthorized', students: [] }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const explicitSchoolId = searchParams.get('school_id')?.trim();

  let schoolId =
    explicitSchoolId ||
    (session as any).primary_school?.id ||
    session.roles?.find((r: any) => r.role === 'school_admin' && r.school_id)?.school_id ||
    session.roles?.find((r: any) => r.school_id)?.school_id ||
    null;

  const supabase = getAdminClient();

  if (!schoolId) {
    const { data: firstSchool } = await supabase.from('schools').select('id').order('name').limit(1).maybeSingle();
    schoolId = firstSchool?.id || null;
  }

  if (!schoolId) {
    return NextResponse.json({ error: 'School ID required', students: [] }, { status: 400 });
  }

  try {
    const { data: students, error } = await supabase
      .from('students')
      .select('id, first_name, last_name, student_id_number, photo_url, is_active, class:school_classes(id, name, grade)')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('last_name');

    if (error) {
      console.error('[GET /api/school-admin/students] DB error:', error);
      return NextResponse.json({ error: error.message, students: [] }, { status: 500 });
    }

    return NextResponse.json({ success: true, school_id: schoolId, students: students || [] });
  } catch (err: any) {
    console.error('[GET /api/school-admin/students] Server error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error', students: [] }, { status: 500 });
  }
}
