/**
 * AUTOMATED DAILY ATTENDANCE ROLL-CALL ENGINE
 * 
 * Analyzes and aggregates institutional attendance data across students and staff:
 * 1. Queries all active enrolled students for a school; identifies Present (with arrival timestamps) vs Absent.
 * 2. Queries all active staff members; identifies Signed-In (with clock-in timestamps) vs Absent.
 * 3. Computes attendance rates, on-time arrivals, late arrivals, and class-level roll-call breakdowns.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase/admin';
import { todayInLagos, formatTimeLagos, formatDateLagos } from '@/lib/timezone';
import { lagosDayBoundsFromDateStr } from '@/lib/attendance/lagos-dates';
import { fetchSchoolLateThreshold } from '@/lib/attendance/staff-report';
import { minutesLateAtTimestamp } from '@/lib/timezone';

export interface StudentRollCallItem {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  admission_number?: string;
  class_id?: string;
  class_name: string;
  status: 'present' | 'absent';
  arrival_time: string | null; // e.g. "07:45 AM"
  arrival_timestamp: string | null;
  departure_time: string | null;
  is_late: boolean;
  minutes_late: number | null;
  location_name?: string | null;
  verification_method?: string | null;
}

export interface StaffRollCallItem {
  user_id: string;
  full_name: string;
  role: string;
  email?: string;
  phone?: string;
  status: 'present' | 'absent';
  clock_in_time: string | null; // e.g. "07:30 AM"
  clock_in_timestamp: string | null;
  clock_out_time: string | null;
  is_late: boolean;
  minutes_late: number | null;
}

export interface ClassAttendanceSummary {
  class_id: string;
  class_name: string;
  total_enrolled: number;
  total_present: number;
  total_absent: number;
  total_late: number;
  total_on_time: number;
  attendance_rate_pct: number;
}

export interface DailyRollCallReport {
  school_id: string;
  school_name: string;
  date: string; // YYYY-MM-DD
  formatted_date: string; // e.g., "15 Oct 2026"
  shift: 'morning' | 'afternoon' | 'full_day';
  generated_at: string;
  students: {
    total_enrolled: number;
    total_present: number;
    total_absent: number;
    total_on_time: number;
    total_late: number;
    attendance_rate_pct: number;
    items: StudentRollCallItem[];
    by_class: ClassAttendanceSummary[];
  };
  staff: {
    total_active: number;
    total_present: number;
    total_absent: number;
    total_on_time: number;
    total_late: number;
    attendance_rate_pct: number;
    items: StaffRollCallItem[];
  };
  highlights: {
    absent_students_count: number;
    absent_staff_count: number;
    late_arrivals_count: number;
    top_absentee_classes: Array<{ class_name: string; absent_count: number }>;
  };
}

export interface GenerateDailyRollCallParams {
  schoolId: string;
  dateStr?: string;
  shift?: 'morning' | 'afternoon' | 'full_day';
  supabaseClient?: SupabaseClient;
}

/**
 * Executes a comprehensive roll-call calculation for a school on a given calendar date.
 */
export async function generateDailyRollCall({
  schoolId,
  dateStr = todayInLagos(),
  shift = 'morning',
  supabaseClient,
}: GenerateDailyRollCallParams): Promise<DailyRollCallReport> {
  const supabase = supabaseClient || getAdminClient();
  const { startIso, endIso } = lagosDayBoundsFromDateStr(dateStr);

  // 1. Fetch School Information & Late Cutoff Threshold
  const [schoolRes, lateThreshold] = await Promise.all([
    supabase
      .from('schools')
      .select('id, name, gate_open_time, gate_close_time, late_threshold')
      .eq('id', schoolId)
      .single(),
    fetchSchoolLateThreshold(supabase, schoolId),
  ]);

  const schoolName = schoolRes.data?.name || 'Educational Institution';
  const studentLateCutoff = schoolRes.data?.late_threshold || lateThreshold || '08:00';

  // 2. Fetch Active Enrolled Students and Classes
  const [studentsRes, classesRes] = await Promise.all([
    supabase
      .from('students')
      .select('id, first_name, last_name, student_id_number, class_id')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('last_name'),
    supabase
      .from('school_classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .eq('is_active', true),
  ]);

  const rawStudents = studentsRes.data || [];
  const rawClasses = classesRes.data || [];

  const classMap = new Map<string, string>();
  for (const c of rawClasses) {
    classMap.set(c.id, c.name || 'Unassigned');
  }

  // 3. Fetch Student Attendance Records (Arrivals & Departures for this day)
  const studentIds = rawStudents.map((s) => s.id);
  let attendanceRecords: Array<{
    student_id: string;
    type: string;
    timestamp: string;
    status?: string | null;
    minutes_late?: number | null;
    location_name?: string | null;
    verification_method?: string | null;
  }> = [];

  if (studentIds.length > 0) {
    const { data: recs, error: recsErr } = await supabase
      .from('attendance_records')
      .select('student_id, type, timestamp, status, minutes_late, location_name, verification_method')
      .eq('school_id', schoolId)
      .in('student_id', studentIds)
      .gte('timestamp', startIso)
      .lte('timestamp', endIso)
      .order('timestamp', { ascending: true });

    if (!recsErr && recs) {
      attendanceRecords = recs;
    }
  }

  // Map arrivals and departures per student
  const arrivalByStudent = new Map<string, any>();
  const departureByStudent = new Map<string, any>();

  for (const rec of attendanceRecords) {
    if (rec.type === 'arrival' && !arrivalByStudent.has(rec.student_id)) {
      arrivalByStudent.set(rec.student_id, rec);
    } else if (rec.type === 'departure') {
      departureByStudent.set(rec.student_id, rec);
    }
  }

  // 4. Construct Student Roll-Call Items & Class-Level Aggregates
  const studentItems: StudentRollCallItem[] = [];
  const classAggregates = new Map<string, ClassAttendanceSummary>();

  for (const c of rawClasses) {
    classAggregates.set(c.id, {
      class_id: c.id,
      class_name: c.name,
      total_enrolled: 0,
      total_present: 0,
      total_absent: 0,
      total_late: 0,
      total_on_time: 0,
      attendance_rate_pct: 0,
    });
  }

  let totalStudentPresent = 0;
  let totalStudentAbsent = 0;
  let totalStudentLate = 0;
  let totalStudentOnTime = 0;

  for (const s of rawStudents) {
    const arrival = arrivalByStudent.get(s.id);
    const departure = departureByStudent.get(s.id);
    const className = (s.class_id && classMap.get(s.class_id)) || 'Unassigned';

    const isPresent = !!arrival;
    let isLate = false;
    let minutesLate: number | null = null;

    if (isPresent && arrival.timestamp) {
      totalStudentPresent++;
      // Determine if student was late
      if (arrival.status === 'late' || (typeof arrival.minutes_late === 'number' && arrival.minutes_late > 0)) {
        isLate = true;
        minutesLate = arrival.minutes_late || 1;
      } else {
        const computedLate = minutesLateAtTimestamp(arrival.timestamp, studentLateCutoff);
        if (computedLate != null && computedLate > 0) {
          isLate = true;
          minutesLate = computedLate;
        }
      }

      if (isLate) {
        totalStudentLate++;
      } else {
        totalStudentOnTime++;
      }
    } else {
      totalStudentAbsent++;
    }

    const item: StudentRollCallItem = {
      id: s.id,
      first_name: s.first_name,
      last_name: s.last_name,
      full_name: `${s.first_name} ${s.last_name}`.trim(),
      admission_number: s.student_id_number,
      class_id: s.class_id,
      class_name: className,
      status: isPresent ? 'present' : 'absent',
      arrival_time: arrival ? formatTimeLagos(arrival.timestamp) : null,
      arrival_timestamp: arrival ? arrival.timestamp : null,
      departure_time: departure ? formatTimeLagos(departure.timestamp) : null,
      is_late: isLate,
      minutes_late: minutesLate,
      location_name: arrival?.location_name || null,
      verification_method: arrival?.verification_method || null,
    };

    studentItems.push(item);

    // Update Class Aggregates
    if (s.class_id && classAggregates.has(s.class_id)) {
      const classSummary = classAggregates.get(s.class_id)!;
      classSummary.total_enrolled++;
      if (isPresent) {
        classSummary.total_present++;
        if (isLate) classSummary.total_late++;
        else classSummary.total_on_time++;
      } else {
        classSummary.total_absent++;
      }
    }
  }

  // Calculate percentages for classes
  const byClassList: ClassAttendanceSummary[] = Array.from(classAggregates.values()).map((c) => ({
    ...c,
    attendance_rate_pct:
      c.total_enrolled > 0 ? Math.round((c.total_present / c.total_enrolled) * 1000) / 10 : 0,
  }));

  const studentAttendanceRate =
    rawStudents.length > 0
      ? Math.round((totalStudentPresent / rawStudents.length) * 1000) / 10
      : 0;

  // 5. Fetch Active Staff Members and Their Roles
  const { data: staffRoles } = await supabase
    .from('user_school_roles')
    .select('user_id, role, user_profiles(full_name, email, phone)')
    .eq('school_id', schoolId)
    .in('role', ['staff', 'teacher', 'gate_officer', 'school_admin'])
    .eq('is_active', true);

  const rawStaff = staffRoles || [];
  const staffUserIds = rawStaff.map((r) => r.user_id);

  // 6. Fetch Staff Attendance Scans for Today
  let staffScans: Array<{
    user_id: string;
    type: string;
    timestamp: string;
  }> = [];

  if (staffUserIds.length > 0) {
    const { data: sScans, error: sErr } = await supabase
      .from('staff_attendance')
      .select('user_id, type, timestamp')
      .eq('school_id', schoolId)
      .in('user_id', staffUserIds)
      .gte('timestamp', startIso)
      .lte('timestamp', endIso)
      .order('timestamp', { ascending: true });

    if (!sErr && sScans) {
      staffScans = sScans;
    }
  }

  const staffClockInMap = new Map<string, string>();
  const staffClockOutMap = new Map<string, string>();

  for (const scan of staffScans) {
    if (scan.type === 'clock_in' && !staffClockInMap.has(scan.user_id)) {
      staffClockInMap.set(scan.user_id, scan.timestamp);
    } else if (scan.type === 'clock_out') {
      staffClockOutMap.set(scan.user_id, scan.timestamp);
    }
  }

  // 7. Construct Staff Roll-Call Items
  const staffItems: StaffRollCallItem[] = [];
  let totalStaffPresent = 0;
  let totalStaffAbsent = 0;
  let totalStaffLate = 0;
  let totalStaffOnTime = 0;

  for (const st of rawStaff) {
    const userProfile: any = Array.isArray(st.user_profiles) ? st.user_profiles[0] : st.user_profiles;
    const fullName = userProfile?.full_name || 'Staff Member';
    const email = userProfile?.email;
    const phone = userProfile?.phone;

    const clockInIso = staffClockInMap.get(st.user_id);
    const clockOutIso = staffClockOutMap.get(st.user_id);

    const isPresent = !!clockInIso;
    let isLate = false;
    let minutesLate: number | null = null;

    if (isPresent && clockInIso) {
      totalStaffPresent++;
      const computedLate = minutesLateAtTimestamp(clockInIso, lateThreshold || '08:00');
      if (computedLate != null && computedLate > 0) {
        isLate = true;
        minutesLate = computedLate;
        totalStaffLate++;
      } else {
        totalStaffOnTime++;
      }
    } else {
      totalStaffAbsent++;
    }

    const formattedRole =
      st.role === 'gate_officer'
        ? 'Gate Officer'
        : st.role === 'school_admin'
        ? 'School Administrator'
        : st.role === 'teacher'
        ? 'Teacher'
        : 'Staff';

    staffItems.push({
      user_id: st.user_id,
      full_name: fullName,
      role: formattedRole,
      email,
      phone,
      status: isPresent ? 'present' : 'absent',
      clock_in_time: clockInIso ? formatTimeLagos(clockInIso) : null,
      clock_in_timestamp: clockInIso || null,
      clock_out_time: clockOutIso ? formatTimeLagos(clockOutIso) : null,
      is_late: isLate,
      minutes_late: minutesLate,
    });
  }

  const staffAttendanceRate =
    rawStaff.length > 0
      ? Math.round((totalStaffPresent / rawStaff.length) * 1000) / 10
      : 0;

  // Identify top classes with absent students
  const topAbsentClasses = [...byClassList]
    .sort((a, b) => b.total_absent - a.total_absent)
    .slice(0, 3)
    .map((c) => ({
      class_name: c.class_name,
      absent_count: c.total_absent,
    }));

  return {
    school_id: schoolId,
    school_name: schoolName,
    date: dateStr,
    formatted_date: formatDateLagos(`${dateStr}T12:00:00+01:00`),
    shift,
    generated_at: new Date().toISOString(),
    students: {
      total_enrolled: rawStudents.length,
      total_present: totalStudentPresent,
      total_absent: totalStudentAbsent,
      total_on_time: totalStudentOnTime,
      total_late: totalStudentLate,
      attendance_rate_pct: studentAttendanceRate,
      items: studentItems,
      by_class: byClassList,
    },
    staff: {
      total_active: rawStaff.length,
      total_present: totalStaffPresent,
      total_absent: totalStaffAbsent,
      total_on_time: totalStaffOnTime,
      total_late: totalStaffLate,
      attendance_rate_pct: staffAttendanceRate,
      items: staffItems,
    },
    highlights: {
      absent_students_count: totalStudentAbsent,
      absent_staff_count: totalStaffAbsent,
      late_arrivals_count: totalStudentLate + totalStaffLate,
      top_absentee_classes: topAbsentClasses,
    },
  };
}
