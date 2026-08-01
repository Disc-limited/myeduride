import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const schoolId = request.nextUrl.searchParams.get('school_id');
    const schoolName = request.nextUrl.searchParams.get('school_name');

    const supabase = getAdminClient();

    // 1. Resolve school ID if schoolName was passed
    let resolvedSchoolId = schoolId;
    if (!resolvedSchoolId && schoolName) {
      const { data: matchedSchool } = await supabase
        .from('schools')
        .select('id')
        .ilike('name', schoolName.trim())
        .maybeSingle();

      if (matchedSchool) {
        resolvedSchoolId = matchedSchool.id;
      }
    }

    const defaultClasses = [
      'Nursery 1',
      'Nursery 2',
      'Primary 1',
      'Primary 2',
      'Primary 3',
      'Primary 4',
      'Primary 5',
      'Primary 6',
      'JSS 1',
      'JSS 2',
      'JSS 3',
      'SSS 1',
      'SSS 2',
      'SSS 3',
    ];

    let dbClasses: string[] = [];
    let dbStudents: Array<{
      id: string;
      name: string;
      grade: string;
      student_id_number?: string;
      photo?: string;
    }> = [];

    if (resolvedSchoolId) {
      // Fetch classes from `school_classes`
      const { data: classRows, error: classErr } = await supabase
        .from('school_classes')
        .select('id, name')
        .eq('school_id', resolvedSchoolId)
        .order('name');

      if (classErr) {
        console.error('[school-details] class error:', classErr.message);
      }

      if (classRows && classRows.length > 0) {
        dbClasses = classRows.map((c: { name: string }) => c.name).filter(Boolean);
      }

      // Fetch students from `students` joining `school_classes`
      const { data: studentRows, error: studErr } = await supabase
        .from('students')
        .select('id, first_name, last_name, student_id_number, photo_url, school_classes(name)')
        .eq('school_id', resolvedSchoolId)
        .eq('is_active', true);

      if (studErr) {
        console.error('[school-details] student error:', studErr.message);
      }

      if (studentRows && studentRows.length > 0) {
        dbStudents = (studentRows as any[]).map((s) => {
          const classObj = Array.isArray(s.school_classes) ? s.school_classes[0] : s.school_classes;
          return {
            id: s.id,
            name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Student',
            grade: classObj?.name || 'Primary 1',
            student_id_number: s.student_id_number || '',
            photo: s.photo_url || 'https://images.unsplash.com/photo-1543332164-6e82f355badc?auto=format&fit=crop&q=80&w=200',
          };
        });
      }
    }

    // Combine DB classes with default classes
    const combinedClasses = Array.from(new Set([...dbClasses, ...defaultClasses]));

    return NextResponse.json({
      school_id: resolvedSchoolId,
      classes: combinedClasses,
      students: dbStudents,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load school details';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
