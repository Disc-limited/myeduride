import type { SupabaseClient } from '@supabase/supabase-js';

export type SchoolCustomRole = {
  id: string;
  school_id: string;
  name: string;
  slug: string;
  can_assign_class: boolean;
  sort_order: number;
  is_active: boolean;
};

export function slugifyRoleName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'role';
}

/** Roles that get ID card profile + gate sign-in (not parents). */
export const STAFF_PROFILE_ACCESS_ROLES = new Set([
  'staff',
  'teacher',
  'gate_officer',
  'school_admin',
]);

export async function fetchCustomRoles(
  supabase: SupabaseClient,
  schoolId: string
): Promise<SchoolCustomRole[]> {
  const { data, error } = await supabase
    .from('school_custom_roles')
    .select('id, school_id, name, slug, can_assign_class, sort_order, is_active')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('sort_order')
    .order('name');

  if (error) {
    console.warn('[custom-roles] fetch:', error.message);
    return [];
  }

  // If no custom roles exist yet for this school, auto-seed default standard roles
  if (!data || data.length === 0) {
    const defaultJobRoles = [
      { name: 'Class Teacher', slug: 'class_teacher', can_assign_class: true, sort_order: 0 },
      { name: 'Subject Teacher', slug: 'subject_teacher', can_assign_class: true, sort_order: 1 },
      { name: 'Accountant', slug: 'accountant', can_assign_class: false, sort_order: 2 },
      { name: 'Driver', slug: 'driver', can_assign_class: false, sort_order: 3 },
      { name: 'Cleaner', slug: 'cleaner', can_assign_class: false, sort_order: 4 },
      { name: 'Security Officer', slug: 'security_officer', can_assign_class: false, sort_order: 5 },
    ];
    try {
      const { data: seeded, error: seedErr } = await supabase
        .from('school_custom_roles')
        .insert(defaultJobRoles.map((r) => ({ ...r, school_id: schoolId, is_active: true })))
        .select('id, school_id, name, slug, can_assign_class, sort_order, is_active')
        .order('sort_order');
      if (!seedErr && seeded && seeded.length > 0) {
        return seeded as SchoolCustomRole[];
      }
    } catch (seedErr) {
      console.warn('[custom-roles] auto-seed notice:', seedErr);
    }
  }

  return (data || []) as SchoolCustomRole[];
}

export async function getCustomRole(
  supabase: SupabaseClient,
  roleId: string,
  schoolId: string
): Promise<SchoolCustomRole | null> {
  const { data, error } = await supabase
    .from('school_custom_roles')
    .select('id, school_id, name, slug, can_assign_class, sort_order, is_active')
    .eq('id', roleId)
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;
  return data as SchoolCustomRole;
}
