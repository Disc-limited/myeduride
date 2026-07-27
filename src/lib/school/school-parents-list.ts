import type { SupabaseClient } from '@supabase/supabase-js';
import type { StudentParentCredential } from '@/lib/school/student-parent-credentials';
import { fetchStudentParentCredentials } from '@/lib/school/student-parent-credentials';
import { normalizeUsername } from '@/lib/auth/username';

export type SchoolParentChild = {
  student_id: string;
  student_name: string;
  class_name: string | null;
  student_id_number: string;
};

export type SchoolParentRow = {
  id: string | null;
  name: string;
  phone: string | null;
  username: string | null;
  has_login: boolean;
  children: SchoolParentChild[];
};

function displayParentName(row: StudentParentCredential): string {
  return (
    row.parent_name ||
    row.parent_on_file_name ||
    row.parent_username_on_file ||
    row.parent_username ||
    (row.parent_email ? row.parent_email.split('@')[0] : '') ||
    ''
  ).trim();
}

function parentKey(row: StudentParentCredential): string {
  if (row.parent_user_id) return `user:${row.parent_user_id}`;

  const username = normalizeUsername(row.parent_username_on_file || row.parent_username || '');
  if (username) return `username:${username}`;

  const email = (row.parent_email || '').toLowerCase();
  if (email) return `email:${email}`;

  const phone = (row.parent_phone || '').replace(/\D/g, '');
  const name = displayParentName(row).toLowerCase();
  return `name:${name}|${phone}`;
}

function mergeChildren(target: SchoolParentRow, source: SchoolParentRow) {
  for (const child of source.children) {
    if (!target.children.some((c) => c.student_id === child.student_id)) {
      target.children.push(child);
    }
  }
  if (source.id) {
    target.id = source.id;
    target.username = source.username?.trim() || target.username;
    target.has_login = source.has_login || target.has_login;
  }
  if (source.phone && !target.phone) target.phone = source.phone;
  if (!target.name && source.name) target.name = source.name;
}

/** Merge rows keyed by username/email into the logged-in parent row when usernames match. */
function mergeLinkedParentRows(map: Map<string, SchoolParentRow>) {
  const userKeyByUsername = new Map<string, string>();
  for (const [key, parent] of map) {
    if (!key.startsWith('user:') || !parent.username) continue;
    userKeyByUsername.set(normalizeUsername(parent.username), key);
  }

  for (const [key, parent] of [...map.entries()]) {
    if (key.startsWith('username:')) {
      const username = key.slice('username:'.length);
      const userKey = userKeyByUsername.get(username);
      if (userKey) {
        mergeChildren(map.get(userKey)!, parent);
        map.delete(key);
        continue;
      }
    }

    if (key.startsWith('email:') && parent.username) {
      const userKey = userKeyByUsername.get(normalizeUsername(parent.username));
      if (userKey) {
        mergeChildren(map.get(userKey)!, parent);
        map.delete(key);
      }
    }
  }
}

export function aggregateStudentParentRows(rows: StudentParentCredential[]): SchoolParentRow[] {
  const map = new Map<string, SchoolParentRow>();

  for (const row of rows) {
    const name = displayParentName(row);
    if (!name && !row.parent_user_id && !row.parent_username_on_file && !row.parent_email) continue;

    const key = parentKey(row);
    const child: SchoolParentChild = {
      student_id: row.student_id,
      student_name: row.student_name,
      class_name: row.class_name,
      student_id_number: row.student_id_number,
    };

    const hasLogin = !!row.parent_user_id && !!row.parent_username?.trim();
    const existing = map.get(key);

    if (existing) {
      mergeChildren(existing, {
        id: row.parent_user_id,
        name: name || row.parent_username_on_file || row.parent_email || 'Parent',
        phone: row.parent_phone,
        username: row.parent_username?.trim() || row.parent_username_on_file?.trim() || null,
        has_login: hasLogin,
        children: [child],
      });
    } else {
      map.set(key, {
        id: row.parent_user_id,
        name: name || row.parent_username_on_file || row.parent_email || 'Parent',
        phone: row.parent_phone,
        username: row.parent_username?.trim() || row.parent_username_on_file?.trim() || null,
        has_login: hasLogin,
        children: [child],
      });
    }
  }

  mergeLinkedParentRows(map);

  for (const parent of map.values()) {
    parent.children.sort((a, b) => a.student_name.localeCompare(b.student_name));
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

import { deduplicateSchoolParents } from '@/lib/school/deduplicate-parents';

export type UnifiedParentsSummary = {
  parents: SchoolParentRow[];
  total: number;
  with_login: number;
};

/**
 * Returns unified school parents list and consistent metrics across all modules.
 * Runs automatic deduplication to ensure duplicates are consolidated.
 */
export async function getUnifiedSchoolParentsSummary(
  supabase: SupabaseClient,
  schoolId: string,
  opts: { autoDeduplicate?: boolean } = { autoDeduplicate: true }
): Promise<UnifiedParentsSummary> {
  if (opts.autoDeduplicate) {
    await deduplicateSchoolParents(supabase, schoolId).catch((err) =>
      console.error('[AUTO DEDUPLICATE FAILED]', err)
    );
  }

  const profileById = new Map<
    string,
    { id: string; username: string | null; full_name: string | null }
  >();
  const authById = new Map<string, string>();
  const rows = await fetchStudentParentCredentials(
    supabase,
    schoolId,
    profileById,
    authById,
    { repairMissingParents: true }
  );

  const parents = aggregateStudentParentRows(rows);
  const with_login = parents.filter((p) => p.has_login).length;

  return {
    parents,
    total: parents.length,
    with_login,
  };
}

/** Parents on file for active students, consistent across all dashboard pages. */
export async function countSchoolParentsOnFile(
  supabase: SupabaseClient,
  schoolId: string
): Promise<number> {
  const summary = await getUnifiedSchoolParentsSummary(supabase, schoolId, { autoDeduplicate: false });
  return summary.total;
}

