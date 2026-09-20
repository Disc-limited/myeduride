import type { SupabaseClient } from '@supabase/supabase-js';

export interface SchoolTiming {
  id: string;
  name: string;
  student_gate_start?: string | null;
  school_start_time?: string | null;
  student_gate_end?: string | null;
  dismissal_start_time?: string | null;
  gate_open_time?: string | null;
}

export interface TimingClashResult {
  hasClash: boolean;
  reason?: string;
  morningGapMins: number;
  afternoonGapMins: number;
  schoolATimes: { morning: string; afternoon: string };
  schoolBTimes: { morning: string; afternoon: string };
}

/**
 * Parses time string (e.g. '07:30', '08:00:00') into total minutes from midnight
 */
export function parseTimeToMinutes(timeStr?: string | null, fallbackMinutes = 480): number {
  if (!timeStr) return fallbackMinutes;
  const clean = timeStr.trim();
  const parts = clean.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);
    if (!isNaN(hours) && !isNaN(mins)) {
      return hours * 60 + mins;
    }
  }
  return fallbackMinutes;
}

export function formatMinutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Validates whether two schools' schedules can be covered by one escort without a timing clash.
 * Requires at least `bufferMinutes` (default 45 mins) between morning start and afternoon dismissal windows.
 */
export function checkSchoolTimingClash(
  schoolA: SchoolTiming,
  schoolB: SchoolTiming,
  bufferMinutes = 45
): TimingClashResult {
  const morningA = parseTimeToMinutes(schoolA.student_gate_start || schoolA.school_start_time, 450); // default 07:30
  const morningB = parseTimeToMinutes(schoolB.student_gate_start || schoolB.school_start_time, 480); // default 08:00

  const afternoonA = parseTimeToMinutes(schoolA.dismissal_start_time || schoolA.student_gate_end, 840); // default 14:00
  const afternoonB = parseTimeToMinutes(schoolB.dismissal_start_time || schoolB.student_gate_end, 900); // default 15:00

  const morningGap = Math.abs(morningA - morningB);
  const afternoonGap = Math.abs(afternoonA - afternoonB);

  const schoolATimes = {
    morning: formatMinutesToTime(morningA),
    afternoon: formatMinutesToTime(afternoonA),
  };
  const schoolBTimes = {
    morning: formatMinutesToTime(morningB),
    afternoon: formatMinutesToTime(afternoonB),
  };

  if (morningGap < bufferMinutes) {
    return {
      hasClash: true,
      reason: `Morning schedules clash: ${schoolA.name} starts at ${schoolATimes.morning} while ${schoolB.name} starts at ${schoolBTimes.morning} (${morningGap} mins apart). A minimum travel buffer of ${bufferMinutes} minutes is required between school runs.`,
      morningGapMins: morningGap,
      afternoonGapMins: afternoonGap,
      schoolATimes,
      schoolBTimes,
    };
  }

  if (afternoonGap < bufferMinutes) {
    return {
      hasClash: true,
      reason: `Afternoon dismissals clash: ${schoolA.name} dismisses at ${schoolATimes.afternoon} while ${schoolB.name} dismisses at ${schoolBTimes.afternoon} (${afternoonGap} mins apart). A minimum travel buffer of ${bufferMinutes} minutes is required between school gates.`,
      morningGapMins: morningGap,
      afternoonGapMins: afternoonGap,
      schoolATimes,
      schoolBTimes,
    };
  }

  return {
    hasClash: false,
    morningGapMins: morningGap,
    afternoonGapMins: afternoonGap,
    schoolATimes,
    schoolBTimes,
  };
}

/** MyEduRide escorts may pick up students from two schools in the same window. School escorts still need a travel buffer. */
export function escortAllowsOverlappingPickup(escortType?: string | null): boolean {
  const t = String(escortType || '').toLowerCase();
  return t !== 'school_escort';
}

export interface EscortSchoolLimitOptions {
  escortType?: string | null;
  isMyEduRide?: boolean;
  isCityManager?: boolean;
  maxSchools?: number;
}

/**
 * Validates escort school allocation limits.
 * - School Escorts: strictly dedicated to their internal school fleet (limit = 1, or max 2 for emergency deputizing).
 * - MyEduRide Escorts: platform escorts approved by City Manager across multi-school corridors (allows 3+ schools, up to 10 campuses).
 */
export async function validateEscortSchoolLimit(
  supabase: SupabaseClient,
  escortId: string,
  targetSchoolId: string,
  options?: EscortSchoolLimitOptions
): Promise<{ allowed: boolean; error?: string; currentSchoolIds: string[] }> {
  const { data: escortApp } = await supabase
    .from('escort_applications')
    .select('id, user_id, school_id, primary_school_id, secondary_school_id, escort_type, application_data')
    .or(`id.eq.${escortId},user_id.eq.${escortId}`)
    .limit(1)
    .maybeSingle();

  const escortKeys = Array.from(new Set([escortApp?.id, escortApp?.user_id, escortId].filter(Boolean)));
  const { data: assignments } = await supabase
    .from('escort_assignments')
    .select('school_id')
    .in('escort_application_id', escortKeys)
    .in('status', ['active', 'pending_confirmation']);

  const schoolSet = new Set<string>();
  if (escortApp?.primary_school_id) schoolSet.add(escortApp.primary_school_id);
  if (escortApp?.secondary_school_id) schoolSet.add(escortApp.secondary_school_id);

  // Parse application_data.allocated_school_ids
  let appDataObj: any = {};
  if (escortApp?.application_data) {
    if (typeof escortApp.application_data === 'string') {
      try {
        appDataObj = JSON.parse(escortApp.application_data);
      } catch {}
    } else if (typeof escortApp.application_data === 'object') {
      appDataObj = escortApp.application_data;
    }
  }
  if (Array.isArray(appDataObj?.allocated_school_ids)) {
    for (const sid of appDataObj.allocated_school_ids) {
      if (sid) schoolSet.add(sid);
    }
  }

  for (const a of assignments || []) {
    if (a.school_id) schoolSet.add(a.school_id);
  }

  if (schoolSet.has(targetSchoolId)) {
    return { allowed: true, currentSchoolIds: Array.from(schoolSet) };
  }

  // Determine whether this escort is a MyEduRide escort
  const isMyEduRide =
    options?.isMyEduRide ??
    options?.isCityManager ??
    (escortApp?.escort_type === 'myeduride_escort' ||
      escortAllowsOverlappingPickup(escortApp?.escort_type) ||
      options?.escortType === 'myeduride_escort');

  // Max limit: School Escorts = 2, MyEduRide Escorts = 10 (or options.maxSchools)
  const maxLimit = options?.maxSchools ?? (isMyEduRide ? 10 : 2);

  if (schoolSet.size >= maxLimit) {
    return {
      allowed: false,
      error: isMyEduRide
        ? `Escort is already allocated to the maximum of ${maxLimit} schools. Reassign an existing school or contact City Management.`
        : `School Escort is dedicated to their school fleet and cannot be assigned to more than 2 campuses. Pick a MyEduRide escort for multi-school coverage.`,
      currentSchoolIds: Array.from(schoolSet),
    };
  }

  return { allowed: true, currentSchoolIds: Array.from(schoolSet) };
}
