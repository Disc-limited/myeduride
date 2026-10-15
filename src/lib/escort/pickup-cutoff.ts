import { SupabaseClient } from '@supabase/supabase-js';
import { nigeriaNowParts, todayInLagos } from '@/lib/timezone';

export interface PickupCutoffInfo {
  agreedPickupTime: string; // e.g. "07:15 AM"
  pickupHour24: number;
  pickupMinute: number;
  cutoffLagosIso: string;
  isPastCutoff: boolean;
  canCancel: boolean;
  minutesRemaining: number;
  currentLagosTime: string;
  source: 'booking' | 'route' | 'assignment' | 'school_schedule' | 'default';
}

/**
 * Parses any time string format ("07:15 AM", "7:15 AM", "07:15", "14:30")
 * into 24-hour hour and minute integers.
 */
export function parseTimeStringToHourMinute(timeStr?: string | null): { hours: number; minutes: number } {
  if (!timeStr) return { hours: 7, minutes: 15 }; // Default morning pickup time

  const trimmed = timeStr.trim();
  const isPM = /pm/i.test(trimmed);
  const isAM = /am/i.test(trimmed);
  const clean = trimmed.replace(/[^\d:]/g, '');
  const parts = clean.split(':').map((p) => parseInt(p, 10));

  let hours = Number.isFinite(parts[0]) ? parts[0] : 7;
  const minutes = Number.isFinite(parts[1]) ? parts[1] : 15;

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  return { hours: Math.min(23, Math.max(0, hours)), minutes: Math.min(59, Math.max(0, minutes)) };
}

/**
 * Formats 24-hour hours and minutes into "hh:mm A" string (e.g. "07:15 AM")
 */
export function formatHourMinuteTo12Hour(hours: number, minutes: number): string {
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const padH = String(displayHours).padStart(2, '0');
  const padM = String(minutes).padStart(2, '0');
  return `${padH}:${padM} ${period}`;
}

/**
 * Computes pickup cutoff synchronously from a candidate time string in Lagos timezone.
 */
export function computeCutoffFromTimeString(
  candidateTimeStr?: string | null,
  targetDate?: string | null
): PickupCutoffInfo {
  const target = targetDate || todayInLagos();
  const raw = candidateTimeStr || '07:15 AM';
  const { hours, minutes } = parseTimeStringToHourMinute(raw);
  const agreedPickupTime = formatHourMinuteTo12Hour(hours, minutes);

  const now = nigeriaNowParts();
  const currentTotalMinutes = now.hours * 60 + now.minutes;
  const cutoffTotalMinutes = hours * 60 + minutes;

  const minutesRemaining = cutoffTotalMinutes - currentTotalMinutes;
  const isPastCutoff = currentTotalMinutes >= cutoffTotalMinutes;
  const canCancel = !isPastCutoff;

  const padH = String(hours).padStart(2, '0');
  const padM = String(minutes).padStart(2, '0');
  const cutoffLagosIso = `${target}T${padH}:${padM}:00+01:00`;
  const currentLagosTime = formatHourMinuteTo12Hour(now.hours, now.minutes);

  return {
    agreedPickupTime,
    pickupHour24: hours,
    pickupMinute: minutes,
    cutoffLagosIso,
    isPastCutoff,
    canCancel,
    minutesRemaining,
    currentLagosTime,
    source: candidateTimeStr ? 'booking' : 'default',
  };
}

/**
 * Resolves the agreed morning pickup time for a student and calculates whether
 * the strict cancellation cutoff has arrived in Africa/Lagos timezone.
 */
export async function resolveStudentPickupCutoff(
  supabase: SupabaseClient,
  studentId: string,
  schoolId?: string | null,
  dateStr?: string | null
): Promise<PickupCutoffInfo> {
  const targetDate = dateStr || todayInLagos();
  let candidateTimeStr: string | null = null;
  let source: PickupCutoffInfo['source'] = 'default';

  // 1. Check active transport_bookings for custom agreed pickup time
  try {
    const { data: booking } = await supabase
      .from('transport_bookings')
      .select('pickup_time, requested_pickup_at')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (booking?.pickup_time) {
      candidateTimeStr = booking.pickup_time;
      source = 'booking';
    } else if (booking?.requested_pickup_at) {
      const timePart = booking.requested_pickup_at.split('T')[1]?.slice(0, 5);
      if (timePart) {
        candidateTimeStr = timePart;
        source = 'booking';
      }
    }
  } catch (err) {
    console.warn('[pickup-cutoff] transport_bookings check note:', err);
  }

  // 2. Check escort_assignments if not found in booking
  if (!candidateTimeStr) {
    try {
      const { data: assignment } = await supabase
        .from('escort_assignments')
        .select('notes')
        .eq('student_id', studentId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (assignment?.notes) {
        const timeMatch = assignment.notes.match(/\b(0?[1-9]|1[0-2]):[0-5][0-9]\s*(?:AM|PM)\b/i);
        if (timeMatch) {
          candidateTimeStr = timeMatch[0];
          source = 'assignment';
        }
      }
    } catch (err) {
      console.warn('[pickup-cutoff] escort_assignments check note:', err);
    }
  }

  // 3. Check student_route_assignments -> transport_routes
  if (!candidateTimeStr) {
    try {
      const { data: rAssign } = await supabase
        .from('student_route_assignments')
        .select('route:transport_routes(morning_pickup_time)')
        .eq('student_id', studentId)
        .limit(1)
        .maybeSingle();

      const r = Array.isArray(rAssign?.route) ? rAssign?.route[0] : rAssign?.route;
      if (r?.morning_pickup_time) {
        candidateTimeStr = r.morning_pickup_time;
        source = 'route';
      }
    } catch (err) {
      console.warn('[pickup-cutoff] student_route_assignments check note:', err);
    }
  }

  // 4. Check school_day_schedules or schools gate start
  if (!candidateTimeStr && schoolId) {
    try {
      const { data: schedule } = await supabase
        .from('school_day_schedules')
        .select('student_gate_start, morning_pickup_default_time')
        .eq('school_id', schoolId)
        .maybeSingle();

      if ((schedule as any)?.morning_pickup_default_time) {
        candidateTimeStr = (schedule as any).morning_pickup_default_time;
        source = 'school_schedule';
      } else if (schedule?.student_gate_start) {
        // Typically pickup is ~30-45 minutes before gate arrival
        candidateTimeStr = schedule.student_gate_start;
        source = 'school_schedule';
      }
    } catch (err) {
      console.warn('[pickup-cutoff] school schedule check note:', err);
    }
  }

  // 5. Fallback: Standard Nigerian school morning pickup (07:15 AM)
  if (!candidateTimeStr) {
    candidateTimeStr = '07:15 AM';
    source = 'default';
  }

  const { hours, minutes } = parseTimeStringToHourMinute(candidateTimeStr);
  const agreedPickupTime = formatHourMinuteTo12Hour(hours, minutes);

  // Compare against current Lagos time (WAT, UTC+1)
  const now = nigeriaNowParts();
  const currentTotalMinutes = now.hours * 60 + now.minutes;
  const cutoffTotalMinutes = hours * 60 + minutes;

  const minutesRemaining = cutoffTotalMinutes - currentTotalMinutes;
  const isPastCutoff = currentTotalMinutes >= cutoffTotalMinutes;
  const canCancel = !isPastCutoff;

  const padH = String(hours).padStart(2, '0');
  const padM = String(minutes).padStart(2, '0');
  const cutoffLagosIso = `${targetDate}T${padH}:${padM}:00+01:00`;
  const currentLagosTime = formatHourMinuteTo12Hour(now.hours, now.minutes);

  return {
    agreedPickupTime,
    pickupHour24: hours,
    pickupMinute: minutes,
    cutoffLagosIso,
    isPastCutoff,
    canCancel,
    minutesRemaining,
    currentLagosTime,
    source,
  };
}
