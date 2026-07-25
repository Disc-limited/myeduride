import type { SupabaseClient } from '@supabase/supabase-js';

export type ReportStudent = {
  id: string;
  first_name: string;
  last_name: string;
  student_id_number: string;
  class_id: string;
  class_name: string;
};

/** Load students for reports without fragile PostgREST embeds. */
export async function fetchReportStudents(
  supabase: SupabaseClient,
  schoolId: string,
  opts?: { studentIds?: string[] | null; classId?: string | null }
): Promise<{ students: ReportStudent[]; error: string | null }> {
  let q = supabase
    .from('students')
    .select('id, first_name, last_name, student_id_number, class_id')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('last_name');

  if (opts?.studentIds != null) {
    if (opts.studentIds.length === 0) {
      return { students: [], error: null };
    }
    q = q.in('id', opts.studentIds);
  }
  if (opts?.classId) {
    q = q.eq('class_id', opts.classId);
  }

  // Fetch student profiles and school classes in parallel to minimize round-trip latency.
  const [studentsRes, classesRes] = await Promise.all([
    q,
    supabase
      .from('school_classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .eq('is_active', true),
  ]);

  if (studentsRes.error) return { students: [], error: studentsRes.error.message };

  const data = studentsRes.data || [];
  const classes = classesRes.data || [];

  const classNames: Record<string, string> = {};
  for (const c of classes) {
    classNames[c.id] = c.name || '';
  }

  const students: ReportStudent[] = data.map((s) => ({
    id: s.id,
    first_name: s.first_name,
    last_name: s.last_name,
    student_id_number: s.student_id_number,
    class_id: s.class_id,
    class_name: classNames[s.class_id] || '',
  }));

  return { students, error: null };
}
