import type { SupabaseClient } from '@supabase/supabase-js';
import { todayInLagos } from '@/lib/timezone';

/** Max students an escort may board before dropping them at school / homes. */
export const ESCORT_MAX_BATCH_SIZE = 9;

/**
 * Max student-legs per escort per day (to and fro).
 * Morning house pickups + afternoon gate pickups combined.
 */
export const ESCORT_MAX_DAILY_LEGS = 18;

export type EscortBatchPhase = 'morning' | 'afternoon';

export type EscortBatchStatus = {
  phase: EscortBatchPhase;
  max_batch: number;
  max_daily_legs: number;
  /** Students currently on the vehicle awaiting school drop (morning) or home drop (afternoon). */
  on_board: number;
  seats_remaining: number;
  can_pick_more: boolean;
  /** Morning pickups already recorded today. */
  morning_picked: number;
  /** Afternoon gate pickups already recorded today. */
  afternoon_picked: number;
  /** Afternoon home drop-offs completed today. */
  afternoon_dropped: number;
  /** Count of morning + afternoon pickups (to-and-fro legs). */
  daily_legs_used: number;
  daily_legs_remaining: number;
  must_drop_before_next: boolean;
  message: string;
};

function escortIdTokens(escortIds: string | string[]): string[] {
  return Array.from(new Set((Array.isArray(escortIds) ? escortIds : [escortIds]).filter(Boolean).map(String)));
}

async function loadEscortTrips(
  supabase: SupabaseClient,
  escortIds: string | string[],
  tripDate?: string
) {
  const tokens = escortIdTokens(escortIds);
  if (tokens.length === 0) return [] as any[];
  const today = tripDate || todayInLagos();
  const { data } = await supabase
    .from('escort_student_daily_trips')
    .select(
      'id, student_id, school_id, morning_picked_up, afternoon_picked_up, afternoon_dropped_off'
    )
    .eq('trip_date', today)
    .in('escort_id', tokens);
  return data || [];
}

async function studentsArrivedAtSchoolToday(
  supabase: SupabaseClient,
  schoolStudentPairs: Array<{ student_id: string; school_id?: string | null }>,
  tripDate?: string
): Promise<Set<string>> {
  const today = tripDate || todayInLagos();
  const studentIds = Array.from(new Set(schoolStudentPairs.map((p) => p.student_id).filter(Boolean)));
  if (studentIds.length === 0) return new Set();

  const { data } = await supabase
    .from('attendance_records')
    .select('student_id')
    .in('student_id', studentIds)
    .eq('type', 'arrival')
    .gte('timestamp', `${today}T00:00:00.000Z`)
    .lte('timestamp', `${today}T23:59:59.999Z`);

  return new Set((data || []).map((r: any) => r.student_id));
}

export async function getEscortBatchStatus(
  supabase: SupabaseClient,
  escortIds: string | string[],
  phase: EscortBatchPhase = 'morning',
  tripDate?: string
): Promise<EscortBatchStatus> {
  const trips = await loadEscortTrips(supabase, escortIds, tripDate);
  const morningPicked = trips.filter((t) => t.morning_picked_up).length;
  const afternoonPicked = trips.filter((t) => t.afternoon_picked_up).length;
  const afternoonDropped = trips.filter((t) => t.afternoon_dropped_off).length;
  const dailyLegsUsed = morningPicked + afternoonPicked;

  let onBoard = 0;
  if (phase === 'morning') {
    const arrived = await studentsArrivedAtSchoolToday(
      supabase,
      trips.filter((t) => t.morning_picked_up).map((t) => ({ student_id: t.student_id, school_id: t.school_id })),
      tripDate
    );
    onBoard = trips.filter((t) => t.morning_picked_up && !arrived.has(t.student_id)).length;
  } else {
    onBoard = trips.filter((t) => t.afternoon_picked_up && !t.afternoon_dropped_off).length;
  }

  const seatsRemaining = Math.max(0, ESCORT_MAX_BATCH_SIZE - onBoard);
  const dailyLegsRemaining = Math.max(0, ESCORT_MAX_DAILY_LEGS - dailyLegsUsed);
  const mustDrop = onBoard >= ESCORT_MAX_BATCH_SIZE;
  const canPickMore = seatsRemaining > 0 && dailyLegsRemaining > 0 && !mustDrop;

  let message = '';
  if (mustDrop) {
    message =
      phase === 'morning'
        ? `Batch full (${ESCORT_MAX_BATCH_SIZE}/${ESCORT_MAX_BATCH_SIZE}). Drop these students at school before picking more.`
        : `Batch full (${ESCORT_MAX_BATCH_SIZE}/${ESCORT_MAX_BATCH_SIZE}). Deliver these students home before returning for the next batch.`;
  } else if (dailyLegsRemaining <= 0) {
    message = `Daily limit reached (${ESCORT_MAX_DAILY_LEGS} student trips to and fro). No more pickups today.`;
  } else {
    message = `On board ${onBoard}/${ESCORT_MAX_BATCH_SIZE} · Daily ${dailyLegsUsed}/${ESCORT_MAX_DAILY_LEGS}`;
  }

  return {
    phase,
    max_batch: ESCORT_MAX_BATCH_SIZE,
    max_daily_legs: ESCORT_MAX_DAILY_LEGS,
    on_board: onBoard,
    seats_remaining: seatsRemaining,
    can_pick_more: canPickMore,
    morning_picked: morningPicked,
    afternoon_picked: afternoonPicked,
    afternoon_dropped: afternoonDropped,
    daily_legs_used: dailyLegsUsed,
    daily_legs_remaining: dailyLegsRemaining,
    must_drop_before_next: mustDrop,
    message,
  };
}

export async function assertCanBoardStudent(
  supabase: SupabaseClient,
  opts: {
    escortIds: string | string[];
    studentId: string;
    phase: EscortBatchPhase;
    tripDate?: string;
  }
): Promise<{ ok: true; status: EscortBatchStatus } | { ok: false; error: string; status: EscortBatchStatus }> {
  const status = await getEscortBatchStatus(supabase, opts.escortIds, opts.phase, opts.tripDate);
  const trips = await loadEscortTrips(supabase, opts.escortIds, opts.tripDate);
  const existing = trips.find((t) => t.student_id === opts.studentId);

  if (opts.phase === 'morning') {
    if (existing?.morning_picked_up) {
      return { ok: true, status }; // already boarded — idempotent
    }
  } else if (existing?.afternoon_picked_up && !existing?.afternoon_dropped_off) {
    return { ok: true, status };
  }

  if (status.must_drop_before_next || status.on_board >= ESCORT_MAX_BATCH_SIZE) {
    return {
      ok: false,
      status,
      error:
        opts.phase === 'morning'
          ? `You already have ${ESCORT_MAX_BATCH_SIZE} students on board. Drop them at school first before picking more.`
          : `You already have ${ESCORT_MAX_BATCH_SIZE} students for home delivery. Drop them off first, then return for the next batch.`,
    };
  }

  if (status.daily_legs_remaining <= 0) {
    return {
      ok: false,
      status,
      error: `Daily limit of ${ESCORT_MAX_DAILY_LEGS} student trips (to and fro) reached. No more pickups today.`,
    };
  }

  return { ok: true, status };
}

/** Cap an afternoon gate release list to remaining batch seats. */
export function capBatchSelection(studentIds: string[], seatsRemaining: number): string[] {
  const limit = Math.max(0, Math.min(ESCORT_MAX_BATCH_SIZE, seatsRemaining));
  return studentIds.slice(0, limit);
}
