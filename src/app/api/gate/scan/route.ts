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
        scan_hints: {
          can_check_in: checkIn.allowed,
          can_check_out: checkOut.allowed,
          already_complete: today.has_arrival && today.has_departure,
          suggested_mode: checkIn.allowed ? 'arrival' : checkOut.allowed ? 'departure' : null,
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
        scan_hints: {
          can_check_in: checkIn.allowed,
          can_check_out: checkOut.allowed,
          already_complete: today.has_clock_in && today.has_clock_out,
          suggested_mode: checkIn.allowed ? 'arrival' : checkOut.allowed ? 'departure' : null,
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
        linked_children: childrenList,
      });
    }

    return NextResponse.json({ error: 'ID or QR code not recognized — scan a valid student, staff, or parent card' }, { status: 404 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Scan failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
