import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { lagosDayBounds, todayInLagos } from '@/lib/timezone';
import { getGateDayStatus } from '@/lib/gate/school-day-gate';
import { fetchEnrichedPickupQueue } from '@/lib/gate/pickup-queue-enrich';
import { matchPickupPhoto, type PickupPersonRow } from '@/lib/gate/student-pickup-context';

type EnrichedPickupNotice = Record<string, unknown> & {
  student_id: string;
  pickup_person_photo: string | null;
  authorised_pickup_persons: PickupPersonRow[];
};

type EnrichedPickupRequest = Record<string, unknown> & {
  student_id: string;
  pickup_person_photo: string | null;
  authorised_pickup_persons: PickupPersonRow[];
};

/** Gate officer: pickup queue, all students, parent pickup notices for today. */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const schoolId = request.nextUrl.searchParams.get('school_id');
    if (!schoolId) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }

    const allowed = session.roles.some(
      (r) =>
        r.school_id === schoolId &&
        ['gate_officer', 'school_admin', 'super_admin'].includes(r.role)
    );
    if (!allowed && !session.roles.some((r) => r.role === 'super_admin')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const supabase = getAdminClient();
    const { dateStr, startIso, endIso } = lagosDayBounds();

    const { data: school } = await supabase
      .from('schools')
      .select('id, name, logo_url, primary_color')
      .eq('id', schoolId)
      .single();

    const { data: students, error: studListErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, student_id_number, photo_url, qr_code_data, class:school_classes(name)')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('last_name');

    if (studListErr) {
      console.error('[gate/dashboard] students:', studListErr.message);
      return NextResponse.json({ error: studListErr.message }, { status: 500 });
    }

    const studentIds = (students || []).map((s: { id: string }) => s.id);

    const today = dateStr || todayInLagos();

    const queueResult = await fetchEnrichedPickupQueue(supabase, schoolId, {
      today,
      startIso,
      endIso,
      students: students || [],
    });

    if (queueResult.error) {
      console.error('[gate/dashboard] pickup_queue:', queueResult.error);
      return NextResponse.json({ error: queueResult.error }, { status: 500 });
    }

    const pickupQueue = queueResult.pickupQueue;
    const pickupPersonsByStudent = queueResult.pickup_persons_by_student || {};

    const { data: pickupNoticesRaw } = await supabase
      .from('pickup_notices')
      .select(
        `*, student:students(id, first_name, last_name, student_id_number),
         parent:user_profiles!parent_user_id(full_name, phone)`
      )
      .eq('school_id', schoolId)
      .eq('notice_date', dateStr)
      .order('created_at', { ascending: false });

    const { data: pickupRequestsRaw } = await supabase
      .from('pickup_requests')
      .select(`
        *,
        student:students(id, first_name, last_name, student_id_number, photo_url, class:school_classes(name)),
        parent:user_profiles!parent_user_id(full_name, phone)
      `)
      .eq('school_id', schoolId)
      .eq('request_date', dateStr)
      .order('created_at', { ascending: false });

    const enrichNotice = (notice: Record<string, unknown>): EnrichedPickupNotice => {
      const sid = String(notice.student_id ?? '');
      const persons = pickupPersonsByStudent[sid] || [];
      const photo =
        matchPickupPhoto(
          notice.pickup_person_name as string,
          notice.pickup_person_phone as string,
          persons
        ) || null;
      return {
        ...notice,
        student_id: sid,
        pickup_person_photo: photo,
        authorised_pickup_persons: persons,
      };
    };

    const enrichRequest = (req: Record<string, unknown>): EnrichedPickupRequest => {
      const sid = String(req.student_id ?? '');
      const persons = pickupPersonsByStudent[sid] || [];
      const photo =
        matchPickupPhoto(
          req.pickup_person_name as string,
          req.pickup_person_phone as string,
          persons
        ) || null;
      return {
        ...req,
        student_id: sid,
        pickup_person_photo: photo,
        authorised_pickup_persons: persons,
      };
    };

    const pickupNotices: EnrichedPickupNotice[] = (pickupNoticesRaw || []).map((n) =>
      enrichNotice(n as Record<string, unknown>)
    );
    const pickupRequests: EnrichedPickupRequest[] = (pickupRequestsRaw || []).map((r) =>
      enrichRequest(r as Record<string, unknown>)
    );

    const pickupRequestsByStudent: Record<string, EnrichedPickupRequest> = {};
    for (const r of pickupRequests) {
      const sid = r.student_id;
      if (sid && !pickupRequestsByStudent[sid]) pickupRequestsByStudent[sid] = r;
    }

    const gate_day = await getGateDayStatus(supabase, schoolId, today);

    // ==========================================
    // 6. LIVE METRICS & KPI COMPUTATION
    // ==========================================
    // 6a. Student arrival / departure counts today
    const { count: studentArrivalsCount } = await supabase
      .from('attendance_records')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('type', 'arrival')
      .gte('timestamp', startIso)
      .lte('timestamp', endIso);

    const { count: studentDeparturesCount } = await supabase
      .from('attendance_records')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('type', 'departure')
      .gte('timestamp', startIso)
      .lte('timestamp', endIso);

    // 6b. Staff sign-in count today
    const { count: staffClockInCount } = await supabase
      .from('staff_attendance')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('type', 'clock_in')
      .gte('timestamp', startIso)
      .lte('timestamp', endIso);

    // 6c. Visitor counts today
    const { data: todayVisitors } = await supabase
      .from('gate_visitors')
      .select('id, status, entry_time')
      .eq('school_id', schoolId)
      .gte('entry_time', startIso)
      .lte('entry_time', endIso);

    const visitorsTodayCount = todayVisitors?.length || 0;
    const visitorsOnCampusCount = todayVisitors?.filter((v) => v.status === 'on_campus').length || 0;

    // 6d. Incident logs today
    const { data: todayIncidents } = await supabase
      .from('audit_logs')
      .select('id, details, created_at')
      .eq('school_id', schoolId)
      .eq('action', 'gate_incident_reported')
      .gte('created_at', startIso)
      .lte('created_at', endIso);

    const incidentCount = todayIncidents?.length || 0;
    const incidentSummary = {
      security: todayIncidents?.filter((i) => (i.details as any)?.category === 'Security').length || 0,
      visitor: todayIncidents?.filter((i) => (i.details as any)?.category === 'Visitor').length || 0,
      traffic: todayIncidents?.filter((i) => (i.details as any)?.category === 'Traffic').length || 0,
      medical: todayIncidents?.filter((i) => (i.details as any)?.category === 'Medical').length || 0,
      other: todayIncidents?.filter((i) => (i.details as any)?.category === 'Other').length || 0,
    };

    // 6e. Recent Releases (top 5 departures today)
    const { data: recentReleaseLogs } = await supabase
      .from('gate_activity_logs')
      .select(`
        id, action_type, pickup_person_name, pickup_person_phone, details, created_at,
        student:students(first_name, last_name, student_id_number, photo_url, class:school_classes(name))
      `)
      .eq('school_id', schoolId)
      .in('action_type', ['release', 'manual_override'])
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: false })
      .limit(6);

    const recent_releases = (recentReleaseLogs || [])
      .filter((r) => !(r.details as any)?.is_incident)
      .slice(0, 5)
      .map((r) => {
        const st = Array.isArray(r.student) ? r.student[0] : r.student;
        const clsRaw = st?.class as { name?: string } | { name?: string }[] | null | undefined;
        const className = Array.isArray(clsRaw) ? clsRaw[0]?.name : clsRaw?.name;
        const timeObj = new Date(r.created_at);
        const timeStr = timeObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        return {
          id: r.id,
          name: st ? `${st.first_name} ${st.last_name}` : 'Student',
          photo_url: st?.photo_url || null,
          student_id_number: st?.student_id_number || '',
          class_name: className || 'Class',
          released_to: r.pickup_person_name ? `${r.pickup_person_name}${r.pickup_person_phone ? ` (${r.pickup_person_phone})` : ''}` : 'Authorized Parent / Escort',
          gate: 'Gate A',
          time: timeStr,
        };
      });

    // 6f. Officer's Activity (You) today
    const currentUserId = session.user_id;
    const { count: officerStudentArrivals } = await supabase
      .from('attendance_records')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('verified_by_user_id', currentUserId)
      .eq('type', 'arrival')
      .gte('timestamp', startIso)
      .lte('timestamp', endIso);

    const { count: officerStudentDepartures } = await supabase
      .from('attendance_records')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('verified_by_user_id', currentUserId)
      .eq('type', 'departure')
      .gte('timestamp', startIso)
      .lte('timestamp', endIso);

    const { count: officerStaffClockIns } = await supabase
      .from('staff_attendance')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('verified_by_user_id', currentUserId)
      .gte('timestamp', startIso)
      .lte('timestamp', endIso);

    const officer_activity = {
      students_scanned_in: officerStudentArrivals || 0,
      staff_scanned_in: officerStaffClockIns || 0,
      visitors_registered: visitorsTodayCount,
      students_released: officerStudentDepartures || 0,
      override_releases: 0,
      incidents_reported: incidentCount,
      avg_process_time: '12 sec',
      attendance_captured: (officerStudentArrivals || 0) + (officerStudentDepartures || 0) + (officerStaffClockIns || 0),
    };

    return NextResponse.json({
      school: school || null,
      students: students || [],
      pickup_queue: pickupQueue || [],
      pickup_notices: pickupNotices,
      pickup_requests: pickupRequests,
      pickup_requests_by_student: pickupRequestsByStudent,
      pickup_persons_by_student: pickupPersonsByStudent,
      day: dateStr,
      gate_day,
      metrics: {
        students_checked_in: studentArrivalsCount || 0,
        staff_checked_in: staffClockInCount || 0,
        students_released: studentDeparturesCount || 0,
        students_waiting: pickupQueue?.length || 0,
        visitors_today: visitorsTodayCount,
        visitors_on_campus: visitorsOnCampusCount,
        pending_pickups: pickupQueue?.length || 0,
        incident_count: incidentCount,
      },
      recent_releases,
      officer_activity,
      incident_summary: incidentSummary,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load gate data';
    console.error('[gate/dashboard]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
