import type { SupabaseClient } from '@supabase/supabase-js';
import { todayInLagos, nowUtcIso } from '@/lib/timezone';

export type EnsureDismissalReadyInput = {
  schoolId: string;
  studentId: string;
  requestedByUserId?: string | null;
  notes?: string | null;
  pickupPersonName?: string | null;
  pickupPersonPhone?: string | null;
  pickupSource?: string | null;
  /** If an existing completed row exists, leave it alone (default). Set true to reopen to pending. */
  reopenCompleted?: boolean;
};

export type EnsureDismissalReadyResult = {
  ok: boolean;
  created: boolean;
  updated: boolean;
  alreadyReady: boolean;
  dismissalId?: string | null;
  error?: string;
};

async function resolveRequesterId(
  supabase: SupabaseClient,
  schoolId: string,
  preferred?: string | null
): Promise<string | null> {
  if (preferred) return preferred;
  try {
    const { data: adminRole } = await supabase
      .from('user_school_roles')
      .select('user_id')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .in('role', ['school_admin', 'teacher', 'gate_officer'])
      .limit(1)
      .maybeSingle();
    if (adminRole?.user_id) return adminRole.user_id;
  } catch {
    // fall through
  }
  return null;
}

function buildNotes(input: EnsureDismissalReadyInput): string | null {
  const parts: string[] = [];
  if (input.notes?.trim()) parts.push(input.notes.trim());
  if (input.pickupPersonName?.trim()) {
    parts.push(
      `Pickup: ${input.pickupPersonName.trim()}${
        input.pickupPersonPhone ? ` · ${input.pickupPersonPhone}` : ''
      }${input.pickupSource ? ` (${input.pickupSource})` : ''}`
    );
  }
  return parts.length ? parts.join(' | ') : null;
}

/**
 * Ensure a student is on today's Ready for Pickup queue (dismissal_requests).
 * Always supplies requested_by_user_id. Stores pickup details in notes when
 * optional pickup_* columns are not present on the table.
 */
export async function ensureDismissalReady(
  supabase: SupabaseClient,
  input: EnsureDismissalReadyInput
): Promise<EnsureDismissalReadyResult> {
  const today = todayInLagos();
  const requesterId = await resolveRequesterId(supabase, input.schoolId, input.requestedByUserId);
  if (!requesterId) {
    return {
      ok: false,
      created: false,
      updated: false,
      alreadyReady: false,
      error: 'No requester user available to mark ready for pickup',
    };
  }

  const notes = buildNotes(input);

  const { data: existing } = await supabase
    .from('dismissal_requests')
    .select('id, status')
    .eq('school_id', input.schoolId)
    .eq('student_id', input.studentId)
    .eq('dismissal_date', today)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'completed' && !input.reopenCompleted) {
      return {
        ok: true,
        created: false,
        updated: false,
        alreadyReady: false,
        dismissalId: existing.id,
      };
    }
    if (existing.status === 'pending' || existing.status === 'approved') {
      if (notes) {
        await supabase
          .from('dismissal_requests')
          .update({ notes })
          .eq('id', existing.id);
      }
      return {
        ok: true,
        created: false,
        updated: false,
        alreadyReady: true,
        dismissalId: existing.id,
      };
    }
    // completed + reopen, or unexpected status → set pending again
    const { error: updErr } = await supabase
      .from('dismissal_requests')
      .update({
        status: 'pending',
        notes: notes || undefined,
        completed_at: null,
        approved_at: null,
      })
      .eq('id', existing.id);
    if (updErr) {
      return {
        ok: false,
        created: false,
        updated: false,
        alreadyReady: false,
        dismissalId: existing.id,
        error: updErr.message,
      };
    }
    return {
      ok: true,
      created: false,
      updated: true,
      alreadyReady: false,
      dismissalId: existing.id,
    };
  }

  const baseRow: Record<string, unknown> = {
    school_id: input.schoolId,
    student_id: input.studentId,
    dismissal_date: today,
    requested_by_user_id: requesterId,
    status: 'pending',
    notes,
  };

  // Prefer schema with optional pickup columns when present in live DB
  const withPickup = {
    ...baseRow,
    pickup_person_name: input.pickupPersonName || null,
    pickup_person_phone: input.pickupPersonPhone || null,
    pickup_source: input.pickupSource || null,
  };

  let { data: inserted, error: insertErr } = await supabase
    .from('dismissal_requests')
    .insert(withPickup)
    .select('id')
    .single();

  // Fallback when pickup_* columns do not exist
  if (insertErr && /pickup_person|pickup_source|column/i.test(insertErr.message || '')) {
    const retry = await supabase
      .from('dismissal_requests')
      .insert(baseRow)
      .select('id')
      .single();
    inserted = retry.data;
    insertErr = retry.error;
  }

  if (insertErr) {
    if (insertErr.code === '23505') {
      return { ok: true, created: false, updated: false, alreadyReady: true };
    }
    return {
      ok: false,
      created: false,
      updated: false,
      alreadyReady: false,
      error: insertErr.message,
    };
  }

  return {
    ok: true,
    created: true,
    updated: false,
    alreadyReady: false,
    dismissalId: inserted?.id || null,
  };
}

/**
 * Queue multiple students for immediate gate release.
 */
export async function ensureStudentsReadyForPickup(
  supabase: SupabaseClient,
  opts: {
    schoolId: string;
    studentIds: string[];
    requestedByUserId?: string | null;
    notes?: string | null;
    pickupPersonName?: string | null;
    pickupPersonPhone?: string | null;
    pickupSource?: string | null;
  }
): Promise<{ queued: number; alreadyReady: number; failed: number }> {
  let queued = 0;
  let alreadyReady = 0;
  let failed = 0;
  const unique = Array.from(new Set(opts.studentIds.filter(Boolean)));
  for (const studentId of unique) {
    const result = await ensureDismissalReady(supabase, {
      schoolId: opts.schoolId,
      studentId,
      requestedByUserId: opts.requestedByUserId,
      notes: opts.notes || `Ready for pickup · ${nowUtcIso()}`,
      pickupPersonName: opts.pickupPersonName,
      pickupPersonPhone: opts.pickupPersonPhone,
      pickupSource: opts.pickupSource,
    });
    if (!result.ok) failed += 1;
    else if (result.created || result.updated) queued += 1;
    else if (result.alreadyReady) alreadyReady += 1;
  }
  return { queued, alreadyReady, failed };
}
