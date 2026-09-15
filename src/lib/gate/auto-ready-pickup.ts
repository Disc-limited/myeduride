import type { SupabaseClient } from '@supabase/supabase-js';
import { lagosDayBounds, nigeriaNowParts, nowUtcIso, todayInLagos } from '@/lib/timezone';
import { getGateDayStatus } from '@/lib/gate/school-day-gate';
import { ensureDismissalReady } from '@/lib/gate/ensure-dismissal-ready';

export type SchoolDismissalTimes = {
  dismissal_start_time?: string | null;
  dismissal_end_time?: string | null;
  student_gate_end?: string | null;
};

export function schoolTimeToMinutes(value?: string | null): number | null {
  if (!value) return null;
  const parts = String(value).trim().split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const mins = parseInt(parts[1], 10);
  if (Number.isNaN(hours) || Number.isNaN(mins)) return null;
  return hours * 60 + mins;
}

export function currentLagosMinutes(): number {
  const { hours, minutes } = nigeriaNowParts();
  return hours * 60 + minutes;
}

/**
 * Dismissal window from Gate Settings:
 * starts at dismissal_start_time (fallback: student_gate_end)
 * ends at dismissal_end_time (fallback: student_gate_end when a distinct start exists)
 */
export function dismissalWindowBounds(school: SchoolDismissalTimes): {
  start: number | null;
  end: number | null;
} {
  const start =
    schoolTimeToMinutes(school.dismissal_start_time) ??
    schoolTimeToMinutes(school.student_gate_end);
  const end =
    schoolTimeToMinutes(school.dismissal_end_time) ??
    (school.dismissal_start_time ? schoolTimeToMinutes(school.student_gate_end) : null);
  return {
    start,
    end: end != null && start != null && end > start ? end : null,
  };
}

export function isDismissalWindowOpen(
  school: SchoolDismissalTimes,
  nowMinutes: number = currentLagosMinutes()
): boolean {
  const { start, end } = dismissalWindowBounds(school);
  if (start == null) return false;
  if (nowMinutes < start) return false;
  if (end != null && nowMinutes > end) return false;
  return true;
}

function unwrapRel(rel: unknown): any {
  return Array.isArray(rel) ? rel[0] : rel;
}

/**
 * At the school's configured dismissal start, mark assigned escorts ready
 * and queue their arrived students for gate release — no manual tap required.
 */
export async function ensureAutoReadyForPickup(
  supabase: SupabaseClient,
  schoolId: string | null | undefined
): Promise<{ applied: boolean; escortsReady: number; studentsReady: number }> {
  const empty = { applied: false, escortsReady: 0, studentsReady: 0 };
  if (!schoolId) return empty;

  try {
    const { data: school } = await supabase
      .from('schools')
      .select('id, dismissal_start_time, dismissal_end_time, student_gate_end')
      .eq('id', schoolId)
      .maybeSingle();

    if (!school || !isDismissalWindowOpen(school)) return empty;

    const gateDay = await getGateDayStatus(supabase, schoolId);
    if (!gateDay.gate_open) return empty;

    const today = todayInLagos();
    const { startIso, endIso } = lagosDayBounds();
    const stamp = nowUtcIso();

    const { data: assignments } = await supabase
      .from('escort_assignments')
      .select(`
        student_id,
        escort_application_id,
        assignment_type,
        escort:escort_applications(
          id,
          user_id,
          full_name,
          phone,
          ready_for_pickup,
          today_trip_status
        )
      `)
      .eq('school_id', schoolId)
      .eq('status', 'active');

    const rows = assignments || [];
    if (rows.length === 0) return { applied: true, escortsReady: 0, studentsReady: 0 };

    const studentIds = Array.from(new Set(rows.map((r: any) => r.student_id).filter(Boolean)));

    const [arrivalsRes, departuresRes, existingRes] = await Promise.all([
      studentIds.length
        ? supabase
            .from('attendance_records')
            .select('student_id')
            .eq('school_id', schoolId)
            .eq('type', 'arrival')
            .in('student_id', studentIds)
            .gte('timestamp', startIso)
            .lte('timestamp', endIso)
        : Promise.resolve({ data: [] as Array<{ student_id: string }> }),
      studentIds.length
        ? supabase
            .from('attendance_records')
            .select('student_id')
            .eq('school_id', schoolId)
            .eq('type', 'departure')
            .in('student_id', studentIds)
            .gte('timestamp', startIso)
            .lte('timestamp', endIso)
        : Promise.resolve({ data: [] as Array<{ student_id: string }> }),
      studentIds.length
        ? supabase
            .from('dismissal_requests')
            .select('student_id')
            .eq('school_id', schoolId)
            .eq('dismissal_date', today)
            .in('student_id', studentIds)
            .in('status', ['pending', 'approved'])
        : Promise.resolve({ data: [] as Array<{ student_id: string }> }),
    ]);

    let extraLessonRows: Array<{ student_id: string; is_released?: boolean }> = [];
    let extraLessonLookupFailed = false;
    try {
      if (studentIds.length > 0) {
        const extraRes = await supabase
          .from('extra_lessons')
          .select('student_id, is_released')
          .eq('school_id', schoolId)
          .eq('date', today)
          .in('student_id', studentIds);
        extraLessonRows = extraRes.data || [];
        if (extraRes.error) {
          console.warn('[auto-ready-pickup] extra_lessons query notice:', extraRes.error.message);
          extraLessonLookupFailed = true;
        }
      }
    } catch {
      extraLessonLookupFailed = true;
    }

    const arrived = new Set((arrivalsRes.data || []).map((r: any) => r.student_id));
    const departed = new Set((departuresRes.data || []).map((r: any) => r.student_id));
    const heldForLesson = new Set(
      extraLessonRows.filter((e) => e.is_released === false).map((e) => e.student_id)
    );
    const alreadyReady = new Set((existingRes.data || []).map((d: any) => d.student_id));

    let studentsReady = 0;
    const seenStudent = new Set<string>();
    for (const row of rows) {
      const studentId = (row as any).student_id;
      if (!studentId || seenStudent.has(studentId)) continue;
      seenStudent.add(studentId);
      if (extraLessonLookupFailed) continue;
      if (
        !arrived.has(studentId) ||
        departed.has(studentId) ||
        heldForLesson.has(studentId) ||
        alreadyReady.has(studentId)
      ) {
        continue;
      }
      const escort = unwrapRel((row as any).escort);
      const pickupSource =
        (row as any).assignment_type === 'deputy' ? 'myeduride_escort' : 'school_escort';
      const result = await ensureDismissalReady(supabase, {
        schoolId,
        studentId,
        requestedByUserId: escort?.user_id || null,
        pickupPersonName: escort?.full_name || 'Assigned Escort',
        pickupPersonPhone: escort?.phone || null,
        pickupSource,
        notes: 'Auto-ready at school dismissal start (Gate Settings)',
      });
      if (result.ok && (result.created || result.updated)) {
        studentsReady += 1;
      } else if (!result.ok) {
        console.warn('[auto-ready-pickup] ensureDismissalReady notice:', result.error);
      }
    }

    const escortIds = Array.from(
      new Set(
        rows
          .map((r: any) => unwrapRel(r.escort))
          .filter((e: any) => e?.id && e.today_trip_status !== 'declined' && !e.ready_for_pickup)
          .map((e: any) => e.id)
      )
    );

    let escortsReady = 0;
    if (escortIds.length > 0) {
      const { error: escortErr } = await supabase
        .from('escort_applications')
        .update({
          ready_for_pickup: true,
          ready_for_pickup_at: stamp,
          operational_status: 'Active On Duty',
        })
        .in('id', escortIds);
      if (escortErr) {
        console.warn('[auto-ready-pickup] escort_applications update notice:', escortErr.message);
      } else {
        escortsReady = escortIds.length;
      }
    }

    return { applied: true, escortsReady, studentsReady };
  } catch (err: any) {
    console.warn('[auto-ready-pickup] notice:', err?.message || err);
    return empty;
  }
}
