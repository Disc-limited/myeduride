import type { SupabaseClient } from '@supabase/supabase-js';

export type EligibleClassTeacher = {
  id: string;
  user_id: string;
  full_name: string;
};

/** Users with teacher profile or app role `teacher` / `staff` in the school. */
export async function fetchEligibleClassTeachers(
  supabase: SupabaseClient,
  schoolId: string
): Promise<EligibleClassTeacher[]> {
  const { data: profiles, error: profErr } = await supabase
    .from('teacher_profiles')
    .select('id, user_id, custom_role_id, teacher_responsibility, user:user_profiles(full_name)')
    .eq('school_id', schoolId);

  if (profErr) {
    console.error('[eligible-class-teachers] profiles:', profErr.message);
    return [];
  }

  if (!profiles?.length) return [];

  const eligible: EligibleClassTeacher[] = [];
  for (const p of profiles) {
    const user = Array.isArray(p.user) ? p.user[0] : p.user;
    eligible.push({
      id: p.id as string,
      user_id: p.user_id as string,
      full_name: (user as { full_name?: string })?.full_name || 'Teacher',
    });
  }

  return eligible.sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export async function isEligibleClassTeacherProfile(
  supabase: SupabaseClient,
  schoolId: string,
  teacherProfileId: string | null | undefined
): Promise<boolean> {
  if (!teacherProfileId) return true;

  const { data: profile } = await supabase
    .from('teacher_profiles')
    .select('id')
    .eq('id', teacherProfileId)
    .eq('school_id', schoolId)
    .maybeSingle();

  return !!profile;
}

