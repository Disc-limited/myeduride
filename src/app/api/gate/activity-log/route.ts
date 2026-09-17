import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { todayInLagos, formatTimeLagos } from '@/lib/timezone';
import { lagosDayBoundsFromDateStr } from '@/lib/attendance/lagos-dates';

export const dynamic = 'force-dynamic';

const ACTION_LABELS: Record<string, string> = {
  check_in: 'Sign in',
  check_out: 'Sign out',
  release: 'Released to pickup',
  manual_override: 'Manual override',
  clock_in: 'Staff sign in',
  clock_out: 'Staff sign out',
};

type ActivityEntry = {
  id: string;
  action_type: string;
  action_label: string;
  student_name: string;
  student_id_number: string;
  class_name: string;
  pickup_person_name: string | null;
  pickup_person_phone: string | null;
  gate_officer_name: string;
  gate_officer_user_id: string | null;
  student_id: string | null;
  timestamp: string;
  time_display: string;
  details: Record<string, unknown>;
  source: 'gate_activity' | 'attendance';
};

function classNameFromStudent(st: any): string {
  const clsRaw = st?.class;
  if (Array.isArray(clsRaw)) return clsRaw[0]?.name || '';
  return clsRaw?.name || '';
}

function labelFor(actionType: string, details: Record<string, any>, attendanceType?: string): string {
  let label = ACTION_LABELS[actionType] || actionType;
  if (actionType === 'manual_override') {
    const dir = details.override_type || details.attendance_type || attendanceType;
    if (dir === 'departure') label = 'Manual override · Sign out';
    else if (dir === 'arrival') label = 'Manual override · Sign in';
  }
  return label;
}

/**
 * GET /api/gate/activity-log?school_id=&date=YYYY-MM-DD
 * Merges gate_activity_logs with attendance_records so successful gate
 * sign-ins/sign-outs always appear even if the activity dual-write failed.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const schoolId = sp.get('school_id');
    const dateParam = sp.get('date') || todayInLagos();

    if (!schoolId) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }

    const allowed = session.roles.some(
      (r) =>
        r.school_id === schoolId &&
        ['gate_officer', 'gate_manager', 'security_officer', 'school_admin', 'super_admin'].includes(r.role)
    );
    if (!allowed && !sessionHasRole(session, 'super_admin')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { startIso, endIso } = lagosDayBoundsFromDateStr(dateParam);
    const supabase = getAdminClient();

    // Canonical select; fall back to legacy columns if schema differs
    let rows: any[] = [];
    const canonicalSelect = await supabase
      .from('gate_activity_logs')
      .select(
        `id, action_type, pickup_person_name, pickup_person_phone, details, created_at,
         gate_officer_user_id, student_id,
         student:students(first_name, last_name, student_id_number, class:school_classes(name))`
      )
      .eq('school_id', schoolId)
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: false });

    if (!canonicalSelect.error) {
      rows = canonicalSelect.data || [];
    } else {
      console.warn('[gate/activity-log] canonical select:', canonicalSelect.error.message);
      const legacySelect = await supabase
        .from('gate_activity_logs')
        .select(
          `id, action, actor_user_id, actor_name, details, created_at, student_id,
           student:students(first_name, last_name, student_id_number, class:school_classes(name))`
        )
        .eq('school_id', schoolId)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: false });
      if (legacySelect.error) {
        console.warn('[gate/activity-log] legacy select:', legacySelect.error.message);
      } else {
        rows = (legacySelect.data || []).map((r: any) => ({
          ...r,
          action_type: r.action,
          gate_officer_user_id: r.actor_user_id,
          pickup_person_name: r.details?.pickup_person_name || null,
          pickup_person_phone: r.details?.pickup_person_phone || null,
        }));
      }
    }

    const { data: attendanceRows, error: attErr } = await supabase
      .from('attendance_records')
      .select(
        `id, student_id, type, verification_method, verified_by_user_id, timestamp, source, status,
         student:students(first_name, last_name, student_id_number, class:school_classes(name))`
      )
      .eq('school_id', schoolId)
      .in('type', ['arrival', 'departure'])
      .gte('timestamp', startIso)
      .lte('timestamp', endIso)
      .order('timestamp', { ascending: false });

    if (attErr) {
      console.warn('[gate/activity-log] attendance backfill:', attErr.message);
    }

    const officerIds = new Set<string>();
    for (const r of rows) {
      if (r.gate_officer_user_id) officerIds.add(r.gate_officer_user_id);
      if (r.actor_user_id) officerIds.add(r.actor_user_id);
    }
    for (const a of attendanceRows || []) {
      if (a.verified_by_user_id) officerIds.add(a.verified_by_user_id);
    }

    const officerById: Record<string, { full_name?: string; username?: string }> = {};
    if (officerIds.size > 0) {
      const { data: officers } = await supabase
        .from('user_profiles')
        .select('id, full_name, username')
        .in('id', Array.from(officerIds));
      for (const o of officers || []) {
        officerById[o.id] = o;
      }
    }

    const coveredAttendanceIds = new Set<string>();
    const entries: ActivityEntry[] = [];

    for (const r of rows) {
      const actionType = String(r.action_type || r.action || 'manual_override');
      const officerId = r.gate_officer_user_id || r.actor_user_id || null;
      const st = Array.isArray(r.student) ? r.student[0] : r.student;
      const officer = officerId ? officerById[officerId] || {} : {};
      const details = (r.details || {}) as Record<string, any>;
      if (details.attendance_record_id) {
        coveredAttendanceIds.add(String(details.attendance_record_id));
      }
      const studentName = st
        ? `${st.first_name} ${st.last_name}`.trim()
        : details.staff_name || r.actor_name || 'Staff';

      entries.push({
        id: r.id,
        action_type: actionType,
        action_label: labelFor(actionType, details),
        student_name: studentName,
        student_id_number: st?.student_id_number || '',
        class_name: classNameFromStudent(st),
        pickup_person_name: r.pickup_person_name || details.pickup_person_name || null,
        pickup_person_phone: r.pickup_person_phone || details.pickup_person_phone || null,
        gate_officer_name: officer.full_name || officer.username || r.actor_name || 'Unknown',
        gate_officer_user_id: officerId,
        student_id: r.student_id || null,
        timestamp: r.created_at,
        time_display: formatTimeLagos(r.created_at),
        details,
        source: 'gate_activity',
      });
    }

    for (const a of attendanceRows || []) {
      if (coveredAttendanceIds.has(String(a.id))) continue;

      const method = String(a.verification_method || '').toLowerCase();
      const isOverride =
        method.includes('override') || method === 'manual' || method === 'teacher_manual';
      const actionType =
        a.type === 'departure'
          ? isOverride
            ? 'manual_override'
            : 'check_out'
          : isOverride
            ? 'manual_override'
            : 'check_in';

      const ts = new Date(a.timestamp).getTime();
      const attendanceStudent = Array.isArray(a.student) ? a.student[0] : a.student;
      const dup = entries.some((e) => {
        const sameStudent =
          (a.student_id && e.student_id && String(e.student_id) === String(a.student_id)) ||
          (e.student_id_number &&
            attendanceStudent?.student_id_number &&
            e.student_id_number === attendanceStudent.student_id_number);
        if (!sameStudent) return false;
        return Math.abs(new Date(e.timestamp).getTime() - ts) < 90_000;
      });
      if (dup) continue;

      const st = attendanceStudent;
      const officer = a.verified_by_user_id ? officerById[a.verified_by_user_id] || {} : {};
      const studentName = st ? `${st.first_name} ${st.last_name}`.trim() : 'Student';
      const details = {
        attendance_record_id: a.id,
        attendance_type: a.type,
        verification_method: a.verification_method,
        backfilled_from_attendance: true,
      };

      entries.push({
        id: `att-${a.id}`,
        action_type: actionType,
        action_label: labelFor(actionType, details, a.type),
        student_name: studentName,
        student_id_number: st?.student_id_number || '',
        class_name: classNameFromStudent(st),
        pickup_person_name: null,
        pickup_person_phone: null,
        gate_officer_name: officer.full_name || officer.username || 'Gate',
        gate_officer_user_id: a.verified_by_user_id || null,
        student_id: a.student_id || null,
        timestamp: a.timestamp,
        time_display: formatTimeLagos(a.timestamp),
        details,
        source: 'attendance',
      });
    }

    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      date: dateParam,
      school_id: schoolId,
      entries,
      meta: {
        from_activity_logs: rows.length,
        backfilled_from_attendance: entries.filter((e) => e.source === 'attendance').length,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed';
    console.error('[gate/activity-log]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/gate/activity-log
 * Records gate incidents, emergency escalations, and manual gate logs.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { school_id, category, description, student_id, details } = body;

    const primarySchoolId =
      school_id ||
      session.roles?.find((r) => r.school_id)?.school_id;

    if (!primarySchoolId) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }

    const allowed = session.roles.some(
      (r) =>
        r.school_id === primarySchoolId &&
        ['gate_officer', 'gate_manager', 'security_officer', 'school_admin', 'super_admin'].includes(r.role)
    );
    if (!allowed && !sessionHasRole(session, 'super_admin')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const supabase = getAdminClient();

    const incidentCategory = category || 'Security';
    const incidentDesc = description || 'Gate incident reported';

    const { writeAuditLog } = await import('@/lib/audit/log');
    await writeAuditLog(supabase, {
      school_id: primarySchoolId,
      actor_user_id: session.user_id,
      student_id: student_id || null,
      action: 'gate_incident_reported',
      entity_type: 'gate_activity_logs',
      details: {
        category: incidentCategory,
        description: incidentDesc,
        officer_name: (session as any).full_name || (session as any).username || 'Gate Officer',
        ...(details || {}),
      },
    });

    const { writeGateActivityLog } = await import('@/lib/gate/activity-log');
    await writeGateActivityLog(supabase, {
      school_id: primarySchoolId,
      gate_officer_user_id: session.user_id,
      student_id: student_id || null,
      action_type: 'manual_override',
      actor_name: (session as any).full_name || (session as any).username || null,
      details: {
        is_incident: true,
        category: incidentCategory,
        description: incidentDesc,
        ...(details || {}),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Incident report (${incidentCategory}) recorded successfully.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record incident';
    console.error('[gate/activity-log POST]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
