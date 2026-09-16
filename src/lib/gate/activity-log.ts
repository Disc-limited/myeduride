import type { SupabaseClient } from '@supabase/supabase-js';

export type GateActivityAction =
  | 'check_in'
  | 'check_out'
  | 'release'
  | 'manual_override'
  | 'clock_in'
  | 'clock_out';

export type GateActivityLogInput = {
  school_id: string;
  gate_officer_user_id: string;
  student_id?: string | null;
  action_type: GateActivityAction;
  pickup_person_name?: string | null;
  pickup_person_phone?: string | null;
  details?: Record<string, unknown>;
  actor_name?: string | null;
};

export type WriteGateActivityResult = {
  ok: boolean;
  error?: string | null;
};

/**
 * Persist gate officer actions to gate_activity_logs.
 * Supports both canonical schema (action_type / gate_officer_user_id)
 * and legacy migration-009 shape (action / actor_user_id).
 */
export async function writeGateActivityLog(
  supabase: SupabaseClient,
  entry: GateActivityLogInput
): Promise<WriteGateActivityResult> {
  const details = {
    ...(entry.details || {}),
    pickup_person_name: entry.pickup_person_name?.trim() || null,
    pickup_person_phone: entry.pickup_person_phone?.trim() || null,
  };

  const canonical = {
    school_id: entry.school_id,
    gate_officer_user_id: entry.gate_officer_user_id,
    student_id: entry.student_id ?? null,
    action_type: entry.action_type,
    pickup_person_name: entry.pickup_person_name?.trim() || null,
    pickup_person_phone: entry.pickup_person_phone?.trim() || null,
    details,
  };

  const { error } = await supabase.from('gate_activity_logs').insert(canonical);

  if (!error) return { ok: true, error: null };

  // Legacy schema fallback (migrations/009): action, actor_user_id, no action_type
  const legacyMsg = String(error.message || '');
  if (/action_type|gate_officer_user_id|column|schema cache/i.test(legacyMsg)) {
    const { error: legacyErr } = await supabase.from('gate_activity_logs').insert({
      school_id: entry.school_id,
      actor_user_id: entry.gate_officer_user_id,
      actor_name: entry.actor_name || null,
      action: entry.action_type,
      entity_type: entry.student_id ? 'student' : 'gate',
      entity_id: entry.student_id || null,
      student_id: entry.student_id ?? null,
      details,
    });
    if (!legacyErr) return { ok: true, error: null };
    console.warn('[gate_activity_logs] legacy insert failed:', legacyErr.message);
    return { ok: false, error: legacyErr.message };
  }

  console.warn('[gate_activity_logs]', entry.action_type, error.message);
  return { ok: false, error: error.message };
}

export const logGateActivity = writeGateActivityLog;
