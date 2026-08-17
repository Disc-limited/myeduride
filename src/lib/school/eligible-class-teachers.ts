import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureStaffProfile } from '@/lib/staff/ensure-profile';

export type EligibleClassTeacher = {
  id: string;
  user_id: string;
  full_name: string;
};

/** Users with teacher profile or app role `teacher` / `staff` / `school_admin` in the school. */
export async function fetchEligibleClassTeachers(
  supabase: SupabaseClient,
  schoolId: string
): Promise<EligibleClassTeacher[]> {
  // 1. Fetch all users registered under school staff/teacher/admin roles
  const { data: roles } = await supabase
    .from('user_school_roles')
    .select('user_id')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .in('role', ['teacher', 'staff', 'school_admin']);

  // 2. Ensure each staff/teacher user has a teacher_profile row created
  if (roles && roles.length > 0) {
    for (const r of roles) {
      if (r.user_id) {
        await ensureStaffProfile(supabase, schoolId, r.user_id);
      }
    }
  }

  // 3. Fetch all teacher profiles for this school
  const { data: profiles, error: profErr } = await supabase
    .from('teacher_profiles')
    .select('id, user_id')
    .eq('school_id', schoolId);

  if (profErr) {
    console.error('[eligible-class-teachers] profiles:', profErr.message);
    return [];
  }

  if (!profiles?.length) return [];

  // 4. Fetch user profiles separately to avoid broken PostgREST relation syntax errors
  const userIds = [...new Set(profiles.map((p) => p.user_id).filter(Boolean))];
  const { data: userProfiles } = await supabase
    .from('user_profiles')
    .select('id, full_name, username')
    .in('id', userIds.length > 0 ? userIds : ['none']);

  const userMap = new Map((userProfiles || []).map((u) => [u.id, u.full_name || u.username || 'Teacher']));

  const eligible: EligibleClassTeacher[] = profiles.map((p) => ({
    id: p.id as string,
    user_id: p.user_id as string,
    full_name: userMap.get(p.user_id) || 'Teacher',
  }));

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

