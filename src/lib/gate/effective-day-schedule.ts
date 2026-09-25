import type { SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EffectiveDaySchedule = {
  // Resolved times (day-override wins, then falls back to school global)
  dismissal_start_time: string | null;
  dismissal_end_time: string | null;
  student_gate_end: string | null;
  gate_open_time: string | null;
  school_start_time: string | null;
  late_threshold: string | null;
  gate_close_time: string | null;
  student_gate_start: string | null;
  staff_gate_start: string | null;
  staff_gate_end: string | null;
  // Metadata
  is_day_override: boolean;    // true when a school_day_schedules row overrides today
  day_of_week: number;         // 0=Sun … 6=Sat (JS getDay() convention)
  day_name: string;            // 'Friday'
  is_early_release: boolean;   // true when day dismissal < global dismissal
  override_notes: string | null;
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME_FIELDS = [
  'dismissal_start_time',
  'dismissal_end_time',
  'student_gate_end',
  'gate_open_time',
  'school_start_time',
  'late_threshold',
  'gate_close_time',
  'student_gate_start',
  'staff_gate_start',
  'staff_gate_end',
] as const;

type TimeFieldKey = (typeof TIME_FIELDS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toMins(value: string | null | undefined): number | null {
  if (!value) return null;
  const parts = String(value).trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Get the JS day-of-week (0=Sun … 6=Sat) for a Lagos local date string.
 * We parse as midnight Lagos (UTC+1) to avoid rollover issues.
 */
function lagosDateToDow(dateStr: string): number {
  // dateStr is 'YYYY-MM-DD' in Lagos local time
  // new Date interprets without tz as UTC — we add +01:00 offset
  const d = new Date(`${dateStr}T00:00:00+01:00`);
  return d.getDay();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main resolver
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the effective school schedule for a given Lagos date.
 *
 * Priority:
 *   1. school_day_schedules row for today's day-of-week (is_active = true)
 *   2. schools.* global columns
 *
 * Returns a merged object — non-null fields from the day override replace
 * the corresponding global school setting.
 *
 * Called by:
 *  - ensureAutoReadyForPickup  (auto-queue at dismissal start)
 *  - gate/dashboard API        (supplies effective_schedule to frontend)
 *  - teacher/ready-for-pickup  (time-window validation)
 */
export async function resolveEffectiveDaySchedule(
  supabase: SupabaseClient,
  schoolId: string,
  dateStr: string // 'YYYY-MM-DD' in Lagos time
): Promise<EffectiveDaySchedule> {
  const dow = lagosDateToDow(dateStr);
  const dayName = DAY_NAMES[dow];

  // Parallel fetch: global school schedule + day-of-week override
  const [schoolRes, dayRes] = await Promise.all([
    supabase
      .from('schools')
      .select(TIME_FIELDS.join(', '))
      .eq('id', schoolId)
      .maybeSingle(),
    supabase
      .from('school_day_schedules')
      .select('*')
      .eq('school_id', schoolId)
      .eq('day_of_week', dow)
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  const globalSched = (schoolRes.data ?? {}) as Record<string, string | null>;
  const daySched = (dayRes.data ?? null) as Record<string, string | null> | null;
  const isDayOverride = Boolean(daySched);

  // Merge helper: day override field wins if non-null, else global
  const merge = (field: TimeFieldKey): string | null => {
    const dayVal = daySched?.[field] ?? null;
    if (dayVal !== null && dayVal !== undefined) return String(dayVal).slice(0, 5); // 'HH:MM'
    const globalVal = globalSched[field] ?? null;
    return globalVal ? String(globalVal).slice(0, 5) : null;
  };

  const effectiveDismissal = merge('dismissal_start_time');
  const globalDismissal = globalSched.dismissal_start_time
    ? String(globalSched.dismissal_start_time).slice(0, 5)
    : null;

  // is_early_release: day override sets an earlier dismissal than the global
  const effMins = toMins(effectiveDismissal);
  const globMins = toMins(globalDismissal);
  const isEarlyRelease =
    isDayOverride &&
    effMins !== null &&
    globMins !== null &&
    effMins < globMins;

  return {
    dismissal_start_time: effectiveDismissal,
    dismissal_end_time: merge('dismissal_end_time'),
    student_gate_end: merge('student_gate_end'),
    gate_open_time: merge('gate_open_time'),
    school_start_time: merge('school_start_time'),
    late_threshold: merge('late_threshold'),
    gate_close_time: merge('gate_close_time'),
    student_gate_start: merge('student_gate_start'),
    staff_gate_start: merge('staff_gate_start'),
    staff_gate_end: merge('staff_gate_end'),
    is_day_override: isDayOverride,
    day_of_week: dow,
    day_name: dayName,
    is_early_release: isEarlyRelease,
    override_notes: daySched?.notes ?? null,
  };
}
