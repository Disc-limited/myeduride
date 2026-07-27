import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeUsername } from '@/lib/auth/username';

export type DeduplicationResult = {
  success: boolean;
  totalMerged: number;
  duplicateGroupsResolved: number;
  linksUpdated: number;
  message?: string;
};

/**
 * Normalizes a phone number for comparison (retains digits only).
 */
function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Normalizes an email for comparison.
 */
function normalizeEmail(email: string | null | undefined): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

/**
 * Deduplicates parent user accounts for a given school.
 * Merges secondary duplicate parent profiles into a single primary parent profile,
 * re-links student_parents relations, and deactivates duplicate user_school_roles.
 */
export async function deduplicateSchoolParents(
  supabase: SupabaseClient,
  schoolId: string
): Promise<DeduplicationResult> {
  try {
    // Step 1: Fetch all parent roles for this school
    const { data: parentRoles, error: roleErr } = await supabase
      .from('user_school_roles')
      .select('user_id, is_active')
      .eq('school_id', schoolId)
      .eq('role', 'parent');

    if (roleErr || !parentRoles?.length) {
      return { success: true, totalMerged: 0, duplicateGroupsResolved: 0, linksUpdated: 0 };
    }

    const parentUserIds = [...new Set(parentRoles.map((r) => r.user_id).filter(Boolean))];

    // Step 2: Fetch profiles for these parent user IDs
    const { data: profiles, error: profErr } = await supabase
      .from('user_profiles')
      .select('id, username, full_name, email, phone')
      .in('id', parentUserIds);

    if (profErr || !profiles?.length) {
      return { success: true, totalMerged: 0, duplicateGroupsResolved: 0, linksUpdated: 0 };
    }

    // Group profiles by email, phone, or name+phone
    const groups = new Map<string, typeof profiles>();

    for (const profile of profiles) {
      const emailKey = normalizeEmail(profile.email);
      const phoneKey = normalizePhone(profile.phone);
      const nameKey = (profile.full_name || '').trim().toLowerCase();

      let groupKey = '';
      if (emailKey) {
        groupKey = `email:${emailKey}`;
      } else if (phoneKey.length >= 7) {
        groupKey = `phone:${phoneKey}`;
      } else if (nameKey && phoneKey) {
        groupKey = `name_phone:${nameKey}|${phoneKey}`;
      }

      if (!groupKey) continue;

      const existing = groups.get(groupKey) || [];
      existing.push(profile);
      groups.set(groupKey, existing);
    }

    let totalMerged = 0;
    let duplicateGroupsResolved = 0;
    let linksUpdated = 0;

    // Process groups that contain duplicates (>1 profile)
    for (const [, memberProfiles] of groups.entries()) {
      if (memberProfiles.length <= 1) continue;

      // Select primary profile: prefers one with a username/login, or earliest id
      const sorted = [...memberProfiles].sort((a, b) => {
        const aHasUser = a.username ? 1 : 0;
        const bHasUser = b.username ? 1 : 0;
        if (aHasUser !== bHasUser) return bHasUser - aHasUser;
        return a.id.localeCompare(b.id);
      });

      const primary = sorted[0];
      const duplicates = sorted.slice(1);

      duplicateGroupsResolved++;

      for (const dup of duplicates) {
        totalMerged++;

        // Step A: Re-link student_parents from dup.id to primary.id
        const { data: dupLinks } = await supabase
          .from('student_parents')
          .select('student_id, relationship, is_primary')
          .eq('parent_user_id', dup.id);

        if (dupLinks?.length) {
          for (const link of dupLinks) {
            // Check if primary is already linked to this student
            const { data: existingPrimaryLink } = await supabase
              .from('student_parents')
              .select('id')
              .eq('student_id', link.student_id)
              .eq('parent_user_id', primary.id)
              .maybeSingle();

            if (!existingPrimaryLink) {
              // Create link to primary parent
              await supabase.from('student_parents').insert({
                student_id: link.student_id,
                parent_user_id: primary.id,
                relationship: link.relationship || 'parent',
                is_primary: link.is_primary ?? true,
              });
              linksUpdated++;
            }

            // Remove link from duplicate parent
            await supabase
              .from('student_parents')
              .delete()
              .eq('student_id', link.student_id)
              .eq('parent_user_id', dup.id);
          }
        }

        // Step B: Deactivate duplicate user_school_role
        await supabase
          .from('user_school_roles')
          .update({ is_active: false })
          .eq('school_id', schoolId)
          .eq('user_id', dup.id)
          .eq('role', 'parent');
      }
    }

    return {
      success: true,
      totalMerged,
      duplicateGroupsResolved,
      linksUpdated,
    };
  } catch (error: any) {
    console.error('[DEDUPLICATE PARENTS CRASH]', error);
    return {
      success: false,
      totalMerged: 0,
      duplicateGroupsResolved: 0,
      linksUpdated: 0,
      message: error.message || 'Deduplication failed',
    };
  }
}
