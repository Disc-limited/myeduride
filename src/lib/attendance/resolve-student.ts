import type { SupabaseClient } from '@supabase/supabase-js';
import { scanLookupValues } from '@/lib/attendance/resolve-scan';

/** Find active student by qr_code_data or student_id_number within a school. */
export async function resolveStudentId(
  supabase: SupabaseClient,
  schoolId: string,
  scanOrId: string
): Promise<string | null> {
  const candidates = scanLookupValues(scanOrId);
  for (const value of candidates) {
    const { data: byQr } = await supabase
      .from('students')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .eq('qr_code_data', value)
      .maybeSingle();
    if (byQr?.id) return byQr.id;

    const { data: byNum } = await supabase
      .from('students')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .eq('student_id_number', value)
      .maybeSingle();
    if (byNum?.id) return byNum.id;
  }
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve a student from a card scan or typed ID without requiring school_id first. */
export async function resolveStudentIdAny(
  supabase: SupabaseClient,
  scanOrId: string
): Promise<{ id: string; school_id: string } | null> {
  const candidates = scanLookupValues(scanOrId);
  for (const value of candidates) {
    if (UUID_RE.test(value)) {
      const { data: byId } = await supabase
        .from('students')
        .select('id, school_id')
        .eq('id', value)
        .eq('is_active', true)
        .maybeSingle();
      if (byId?.id) return byId;
    }

    const { data: byQr } = await supabase
      .from('students')
      .select('id, school_id')
      .eq('is_active', true)
      .eq('qr_code_data', value)
      .maybeSingle();
    if (byQr?.id) return byQr;

    const { data: byNum } = await supabase
      .from('students')
      .select('id, school_id')
      .eq('is_active', true)
      .eq('student_id_number', value)
      .maybeSingle();
    if (byNum?.id) return byNum;
  }
  return null;
}
