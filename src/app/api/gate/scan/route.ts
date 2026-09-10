import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { canAccessGateOperations } from '@/lib/gate/access';
import { resolveStudentId } from '@/lib/attendance/resolve-student';
import { resolveStaffProfile, resolveStaffRoleLabel } from '@/lib/attendance/resolve-staff';
import {
  getStudentTodayStatus,
  getStaffTodayStatus,
  validateStudentGateAction,
  validateStaffGateAction,
} from '@/lib/gate/daily-limits';
import { fetchStudentPickupContext } from '@/lib/gate/student-pickup-context';
import { getGateDayStatus } from '@/lib/gate/school-day-gate';
import { sessionHasRole } from '@/lib/session';
import { todayInLagos } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

/**
 * Gate scan — student or staff by QR / ID card.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { scan_data, school_id } = await request.json();
    if (!scan_data) return NextResponse.json({ error: 'No scan data' }, { status: 400 });
    if (!school_id) return NextResponse.json({ error: 'school_id required' }, { status: 400 });

    if (!canAccessGateOperations(session, school_id)) {
      return NextResponse.json({ error: 'Gate access required' }, { status: 403 });
    }

    const supabase = getAdminClient();
    const scan = String(scan_data).trim();

    const gateDay = sessionHasRole(session, 'super_admin')
      ? { date: '', gate_open: true, reason: null, label: null, has_override: false }
      : await getGateDayStatus(supabase, school_id);

    if (!gateDay.gate_open) {
      return NextResponse.json(
        {
          error: `Gate closed today: ${gateDay.label}`,
          code: 'gate_closed',
          gate_day: gateDay,
        },
        { status: 403 }
      );
    }

    const { data: schoolRow } = await supabase
      .from('schools')
      .select('id, name, address, gps_lat, gps_lng, location_address, location_landmark')
      .eq('id', school_id)
      .maybeSingle();

    const schoolLocation = {
      name: schoolRow?.location_address || schoolRow?.address || 'Main Campus Gate',
      gps_coords: schoolRow?.gps_lat != null && schoolRow?.gps_lng != null
        ? `${Number(schoolRow.gps_lat).toFixed(4)}, ${Number(schoolRow.gps_lng).toFixed(4)}`
        : null,
      is_pinned: schoolRow?.gps_lat != null && schoolRow?.gps_lng != null,
      geofence_radius: 200,
    };

    const studentId = await resolveStudentId(supabase, school_id, scan);
    if (studentId) {
      const { data: student } = await supabase
        .from('students')
        .select('id, first_name, last_name, student_id_number, photo_url, class_id')
        .eq('id', studentId)
        .single();

      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }

      let className = '';
      if (student.class_id) {
        const { data: cls } = await supabase
          .from('school_classes')
          .select('name')
          .eq('id', student.class_id)
          .maybeSingle();
        className = cls?.name || '';
      }

      const today = await getStudentTodayStatus(supabase, school_id, studentId);
      const checkIn = validateStudentGateAction(today, 'arrival');
      const checkOut = validateStudentGateAction(today, 'departure');
      const pickup_context = await fetchStudentPickupContext(supabase, school_id, studentId);
      const day = todayInLagos();

      const { data: readyReq } = await supabase
        .from('dismissal_requests')
        .select('id')
        .eq('student_id', studentId)
        .eq('school_id', school_id)
        .eq('dismissal_date', day)
        .in('status', ['pending', 'approved'])
        .maybeSingle();

      return NextResponse.json({
        type: 'student',
        person: {
          id: student.id,
          name: `${student.first_name} ${student.last_name}`,
          student_id: student.student_id_number,
          class_name: className,
          photo_url: student.photo_url,
        },
        today_status: today,
        pickup_context,
        pickup_notice: pickup_context.pickup_notice,
        pickup_request: pickup_context.pickup_request,
        pickup_persons: pickup_context.pickup_persons,
        ready_for_pickup: !!readyReq,
        school_location: schoolLocation,
        scan_hints: {
          can_check_in: checkIn.allowed,
          can_check_out: checkOut.allowed,
          already_complete: today.has_arrival && today.has_departure,
          suggested_mode: today.has_arrival && !today.has_departure ? 'departure' : null,
          message: today.has_arrival && today.has_departure
            ? 'Already checked in and out today'
            : today.has_arrival
              ? 'Already checked in — use Check out only'
              : null,
        },
      });
    }

    const staff = await resolveStaffProfile(supabase, school_id, scan);
    if (staff) {
      const roleLabel = await resolveStaffRoleLabel(supabase, school_id, staff.user_id);
      const today = await getStaffTodayStatus(supabase, school_id, staff.user_id);

      const checkIn = validateStaffGateAction(today, 'arrival');
      const checkOut = validateStaffGateAction(today, 'departure');

      return NextResponse.json({
        type: 'staff',
        person: {
          id: staff.id,
          user_id: staff.user_id,
          name: staff.full_name,
          staff_id: staff.staff_id_number,
          photo_url: staff.photo_url,
          role_label: roleLabel,
        },
        today_status: {
          has_clock_in: today.has_clock_in,
          has_clock_out: today.has_clock_out,
        },
        school_location: schoolLocation,
        scan_hints: {
          can_check_in: checkIn.allowed,
          can_check_out: checkOut.allowed,
          already_complete: today.has_clock_in && today.has_clock_out,
          suggested_mode: today.has_clock_in && !today.has_clock_out ? 'departure' : null,
          message: today.has_clock_in && today.has_clock_out
            ? 'Already signed in and out today'
            : today.has_clock_in
              ? 'Already signed in — use Sign out only'
              : null,
        },
      });
    }

    // 3. Parent Card / Parent QR Scan Resolution
    let parentSearch = scan;
    if (parentSearch.toUpperCase().startsWith('MYEDURIDE:PARENT:')) {
      parentSearch = parentSearch.slice('MYEDURIDE:PARENT:'.length).trim();
    }

    let parentQuery = supabase
      .from('user_profiles')
      .select('id, full_name, username, phone, email, avatar_url');

    // Check if scan is valid UUID vs username vs phone
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parentSearch);
    if (isUuid) {
      parentQuery = parentQuery.eq('id', parentSearch);
    } else {
      parentQuery = parentQuery.or(`username.eq.${parentSearch.toLowerCase()},phone.eq.${parentSearch}`);
    }

    const { data: parentUser } = await parentQuery.maybeSingle();

    if (parentUser) {
      const { data: links } = await supabase
        .from('student_parents')
        .select('student_id, relationship')
        .eq('parent_user_id', parentUser.id);

      const linkedStudentIds = (links || []).map((l: any) => l.student_id);

      let childrenList: any[] = [];
      if (linkedStudentIds.length > 0) {
        const { data: students } = await supabase
          .from('students')
          .select('id, first_name, last_name, student_id_number, photo_url, class_id, class:school_classes(name)')
          .eq('school_id', school_id)
          .in('id', linkedStudentIds)
          .eq('is_active', true);

        const day = todayInLagos();

        const { data: arrivals } = await supabase
          .from('attendance_records')
          .select('student_id, timestamp, status')
          .eq('school_id', school_id)
          .in('student_id', linkedStudentIds)
          .eq('type', 'arrival')
          .order('timestamp', { ascending: false });

        const { data: dismissals } = await supabase
          .from('dismissal_requests')
          .select('student_id, status')
          .eq('school_id', school_id)
          .in('student_id', linkedStudentIds)
          .eq('dismissal_date', day);

        const { data: extraLessons } = await supabase
          .from('extra_lessons')
          .select('student_id, is_released, lesson_end_time, reason')
          .eq('school_id', school_id)
          .in('student_id', linkedStudentIds)
          .eq('date', day);

        const arrivalMap = new Map((arrivals || []).map((a: any) => [a.student_id, a]));
        const dismissalMap = new Map((dismissals || []).map((d: any) => [d.student_id, d]));
        const extraLessonMap = new Map((extraLessons || []).map((e: any) => [e.student_id, e]));

        childrenList = (students || []).map((st: any) => {
          const rel = links?.find((l: any) => l.student_id === st.id)?.relationship || 'Parent / Authorized Escort';
          const arrival = arrivalMap.get(st.id);
          const dismissal = dismissalMap.get(st.id);
          const extraLesson = extraLessonMap.get(st.id);
          const cls = Array.isArray(st.class) ? st.class[0] : st.class;
          return {
            id: st.id,
            first_name: st.first_name,
            last_name: st.last_name,
            student_id: st.student_id_number,
            class_name: cls?.name || 'Class',
            photo_url: st.photo_url,
            relationship: rel,
            present_today: !!arrival,
            arrival_time: arrival?.timestamp || null,
            ready_for_pickup: !!dismissal && dismissal.status !== 'completed',
            dismissal_status: dismissal?.status || null,
            in_extra_lesson: !!extraLesson && !extraLesson.is_released,
            extra_lesson_end_time: extraLesson?.lesson_end_time || null,
            extra_lesson_reason: extraLesson?.reason || null,
          };
        });
      }

      return NextResponse.json({
        type: 'parent',
        parent: {
          id: parentUser.id,
          full_name: parentUser.full_name,
          username: parentUser.username,
          phone: parentUser.phone,
          photo_url: parentUser.avatar_url,
        },
        school_location: schoolLocation,
        linked_children: childrenList,
      });
    }

    // 4. Escort ID Card / QR Scan Resolution
    let escortSearch = scan;
    if (escortSearch.toUpperCase().startsWith('MYEDURIDE:ESCORT:')) {
      escortSearch = escortSearch.slice('MYEDURIDE:ESCORT:'.length).trim();
    }

    const isEscortUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(escortSearch);
    let escortRecord: any = null;

    if (isEscortUuid) {
      const { data: byId } = await supabase
        .from('escort_applications')
        .select('*')
        .or(`id.eq.${escortSearch},user_id.eq.${escortSearch}`)
        .maybeSingle();

      if (byId) {
        escortRecord = byId;
      } else {
        const { data: userProf } = await supabase
          .from('user_profiles')
          .select('id, full_name, phone, avatar_url, username')
          .eq('id', escortSearch)
          .maybeSingle();

        if (userProf) {
          const { data: appByUser } = await supabase
            .from('escort_applications')
            .select('*')
            .eq('user_id', userProf.id)
            .maybeSingle();

          escortRecord = appByUser || {
            id: userProf.id,
            user_id: userProf.id,
            full_name: userProf.full_name,
            phone: userProf.phone,
            passport_photograph: userProf.avatar_url,
          };
        }
      }
    } else {
      const { data: bySearch } = await supabase
        .from('escort_applications')
        .select('*')
        .or(`phone.ilike.%${escortSearch}%,email.ilike.%${escortSearch}%,full_name.ilike.%${escortSearch}%,nin.eq.${escortSearch}`)
        .limit(1)
        .maybeSingle();

      if (bySearch) {
        escortRecord = bySearch;
      }
    }

    if (escortRecord) {
      // Find assigned vehicle and route
      const [vehicleRes, routeRes] = await Promise.all([
        supabase
          .from('school_vehicles')
          .select('id, reg_number, make, model, type, capacity, assigned_driver_name')
          .eq('school_id', school_id)
          .eq('assigned_escort_id', escortRecord.id)
          .maybeSingle(),
        supabase
          .from('transport_routes')
          .select('id, name, code, departure_morning, departure_afternoon')
          .eq('school_id', school_id)
          .eq('assigned_escort_id', escortRecord.id)
          .maybeSingle(),
      ]);

      const vehicle = vehicleRes.data;
      const route = routeRes.data;

      // Query assigned students for this school
      let assignQuery = supabase
        .from('escort_assignments')
        .select(`
          student_id,
          status,
          student:students(
            id,
            first_name,
            last_name,
            student_id_number,
            photo_url,
            house_address,
            pickup_address,
            class_id,
            class:school_classes(name)
          )
        `)
        .eq('school_id', school_id)
        .in('status', ['active', 'pending_confirmation']);

      if (escortRecord.id && escortRecord.user_id) {
        assignQuery = assignQuery.or(`escort_application_id.eq.${escortRecord.id},escort_application_id.eq.${escortRecord.user_id}`);
      } else {
        assignQuery = assignQuery.eq('escort_application_id', escortRecord.id || escortRecord.user_id);
      }

      const { data: assignments } = await assignQuery;
      const rawStudents = (assignments || []).map((a: any) => a.student).filter(Boolean);
      const studentIds = rawStudents.map((s: any) => s.id);

      let arrivalsMap = new Map();
      let departuresMap = new Map();

      if (studentIds.length > 0) {
        const day = todayInLagos();
        const [arrRes, depRes] = await Promise.all([
          supabase
            .from('attendance_records')
            .select('student_id, timestamp, verification_method')
            .eq('school_id', school_id)
            .in('student_id', studentIds)
            .eq('type', 'arrival')
            .gte('timestamp', `${day}T00:00:00.000Z`)
            .lte('timestamp', `${day}T23:59:59.999Z`),
          supabase
            .from('attendance_records')
            .select('student_id, timestamp, verification_method')
            .eq('school_id', school_id)
            .in('student_id', studentIds)
            .eq('type', 'departure')
            .gte('timestamp', `${day}T00:00:00.000Z`)
            .lte('timestamp', `${day}T23:59:59.999Z`),
        ]);

        (arrRes.data || []).forEach((a: any) => arrivalsMap.set(a.student_id, a));
        (depRes.data || []).forEach((d: any) => departuresMap.set(d.student_id, d));
      }

      const studentsManifest = rawStudents.map((st: any) => {
        const arr = arrivalsMap.get(st.id);
        const dep = departuresMap.get(st.id);
        const cls = Array.isArray(st.class) ? st.class[0]?.name : (st.class?.name || 'Class');

        return {
          id: st.id,
          name: `${st.first_name || ''} ${st.last_name || ''}`.trim() || 'Student',
          student_id_number: st.student_id_number || 'N/A',
          photo_url: st.photo_url || null,
          class_name: cls,
          pickup_address: st.house_address || st.pickup_address || 'Designated Stop',
          today_status: {
            has_arrival: Boolean(arr),
            arrival_time: arr?.timestamp ? new Date(arr.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
            has_departure: Boolean(dep),
            departure_time: dep?.timestamp ? new Date(dep.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
          },
        };
      });

      const alreadyArrived = studentsManifest.filter((s) => s.today_status.has_arrival).length;
      const alreadyDeparted = studentsManifest.filter((s) => s.today_status.has_departure).length;
      const totalCount = studentsManifest.length;
      const currentHour = new Date().getHours();
      const suggestedMode = currentHour < 12 ? 'arrival' : 'departure';

      return NextResponse.json({
        type: 'escort_batch',
        escort: {
          id: escortRecord.id,
          user_id: escortRecord.user_id,
          name: escortRecord.full_name || 'Assigned Escort',
          phone: escortRecord.phone || '',
          photo_url: escortRecord.passport_photograph || escortRecord.photo_url || null,
          vehicle_plate: vehicle?.reg_number || 'Transit Vehicle',
          vehicle_name: vehicle ? `${vehicle.make || ''} ${vehicle.model || ''}`.trim() : 'School Bus Fleet',
          route_name: route?.name || 'Assigned Route',
          route_code: route?.code || 'RT-01',
          today_trip_status: escortRecord.today_trip_status || 'pending',
          ready_for_pickup: Boolean(escortRecord.ready_for_pickup),
        },
        students: studentsManifest,
        batch_metrics: {
          total_assigned: totalCount,
          already_checked_in: alreadyArrived,
          already_checked_out: alreadyDeparted,
          pending_arrival: Math.max(0, totalCount - alreadyArrived),
          pending_departure: Math.max(0, totalCount - alreadyDeparted),
        },
        suggested_mode: suggestedMode,
        school_location: schoolLocation,
      });
    }

    return NextResponse.json({ error: 'ID or QR code not recognized — scan a valid student, staff, parent, or escort card' }, { status: 404 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Scan failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
