import type { SupabaseClient } from '@supabase/supabase-js';
import { scanLookupValues } from '@/lib/attendance/resolve-scan';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StudentHit = { id: string; school_id: string };

/**
 * One-shot active-student lookup by QR / student ID / UUID.
 * Optionally restrict to a school (gate officers) or an allow-list of student IDs (escorts).
 */
async function lookupActiveStudent(
  supabase: SupabaseClient,
  scanOrId: string,
  opts?: { schoolId?: string; allowedStudentIds?: string[] }
): Promise<StudentHit | null> {
  const candidates = scanLookupValues(scanOrId);
  if (candidates.length === 0) return null;

  const allowed =
    opts?.allowedStudentIds && opts.allowedStudentIds.length > 0
      ? new Set(opts.allowedStudentIds.map(String))
      : null;

  // Prefer UUID direct hit first (fast path for UUID QR payloads)
  for (const value of candidates) {
    if (!UUID_RE.test(value)) continue;
    let q = supabase
      .from('students')
      .select('id, school_id')
      .eq('id', value)
      .eq('is_active', true)
      .limit(1);
    if (opts?.schoolId) q = q.eq('school_id', opts.schoolId);
    const { data } = await q.maybeSingle();
    if (data?.id) {
      if (allowed && !allowed.has(String(data.id))) return null;
      return data as StudentHit;
    }
  }

  // Single OR query for qr_code_data + student_id_number across all candidates
  const orParts: string[] = [];
  for (const value of candidates) {
    // Escape commas in PostgREST filter values by avoiding exotic chars; IDs are safe
    orParts.push(`qr_code_data.eq.${value}`);
    orParts.push(`student_id_number.eq.${value}`);
  }

  let query = supabase
    .from('students')
    .select('id, school_id, qr_code_data, student_id_number')
    .eq('is_active', true)
    .or(orParts.join(','))
    .limit(5);

  if (opts?.schoolId) {
    query = query.eq('school_id', opts.schoolId);
  }

  let { data: rows } = await query;

  // Case-insensitive fallback if exact match query returns empty
  if (!rows?.length) {
    const ilikeParts: string[] = [];
    for (const value of candidates) {
      const clean = value.replace(/[%,]/g, '').trim();
      if (clean.length >= 3) {
        ilikeParts.push(`student_id_number.ilike.${clean}`);
        ilikeParts.push(`qr_code_data.ilike.%${clean}%`);
      }
    }
    if (ilikeParts.length > 0) {
      let fallbackQuery = supabase
        .from('students')
        .select('id, school_id, qr_code_data, student_id_number')
        .eq('is_active', true)
        .or(ilikeParts.join(','))
        .limit(5);

      if (opts?.schoolId) {
        fallbackQuery = fallbackQuery.eq('school_id', opts.schoolId);
      }
      const fallbackResult = await fallbackQuery;
      rows = fallbackResult.data || null;
    }
  }

  if (!rows?.length) return null;

  // Prefer exact candidate order (first scanLookupValues wins)
  for (const value of candidates) {
    const valLower = value.toLowerCase();
    const hit = rows.find(
      (r: any) =>
        String(r.qr_code_data || '').toLowerCase() === valLower ||
        String(r.student_id_number || '').toLowerCase() === valLower
    );
    if (!hit?.id) continue;
    if (allowed && !allowed.has(String(hit.id))) return null;
    return { id: hit.id, school_id: hit.school_id };
  }

  const first = rows[0];
  if (allowed && !allowed.has(String(first.id))) return null;
  return { id: first.id, school_id: first.school_id };
}

/** Find active student by qr_code_data or student_id_number within a school. */
export async function resolveStudentId(
  supabase: SupabaseClient,
  schoolId: string,
  scanOrId: string
): Promise<string | null> {
  if (!schoolId) return null;
  const hit = await lookupActiveStudent(supabase, scanOrId, { schoolId });
  return hit?.id || null;
}

/** Resolve a student from a card scan or typed ID without requiring school_id first. */
export async function resolveStudentIdAny(
  supabase: SupabaseClient,
  scanOrId: string
): Promise<StudentHit | null> {
  return lookupActiveStudent(supabase, scanOrId);
}

/**
 * Resolve a scan only if the student is in the escort's assigned roster (or school when provided).
 * Gate officers should use resolveStudentId(schoolId). Escorts should use this.
 */
export async function resolveStudentIdForEscort(
  supabase: SupabaseClient,
  scanOrId: string,
  opts: { allowedStudentIds: string[]; schoolId?: string | null }
): Promise<StudentHit | null> {
  if (!opts.allowedStudentIds?.length) return null;
  return lookupActiveStudent(supabase, scanOrId, {
    schoolId: opts.schoolId || undefined,
    allowedStudentIds: opts.allowedStudentIds,
  });
}
