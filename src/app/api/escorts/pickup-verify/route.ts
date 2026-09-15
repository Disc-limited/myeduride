import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAdminClient } from '@/lib/supabase/admin';
import { todayInLagos } from '@/lib/timezone';
import { nowUtcIso } from '@/lib/utils/time';
import { getEscortApplications } from '@/lib/escort/escort-db';
import { findEscortApplicationForSession } from '@/lib/escort/escort-category';
import { resolveStudentIdAny } from '@/lib/attendance/resolve-student';
import { extractHandoverPin, isTodayHandoverPin, normalizePin } from '@/lib/escort/handover-pin';

export const dynamic = 'force-dynamic';

const LIVE_ASSIGNMENT_STATUSES = ['active', 'completed', 'pending_confirmation', 'pending'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escortScheduleKeys(profile: any, session: any): string[] {
  return Array.from(
    new Set(
      [
        profile?.id,
        profile?.user_id,
        profile?.escort_code,
        profile?.escortIdCode,
        session?.user_id,
        session?.id,
      ]
        .filter(Boolean)
        .map((value) => String(value))
    )
  );
}

function assignmentBelongsToEscort(row: any, keys: string[]): boolean {
  const candidates = [
    row?.escort_application_id,
    row?.escort_id,
    row?.assigned_escort_id,
    row?.deputy_escort_application_id,
  ]
    .filter(Boolean)
    .map((value) => String(value));
  return candidates.some((id) => keys.includes(id));
}

async function resolveEscortProfile(supabase: any, session: any) {
  const allApps = await getEscortApplications();
  let profile = session ? findEscortApplicationForSession(allApps, session) : null;

  if (!profile && session?.user_id) {
    const { data } = await supabase
      .from('escort_applications')
      .select('id, user_id, email, full_name, escort_code, status')
      .or(`id.eq.${session.user_id},user_id.eq.${session.user_id}`)
      .limit(1)
      .maybeSingle();
    if (data) profile = data;
  }

  if (!profile && session?.email) {
    const { data } = await supabase
      .from('escort_applications')
      .select('id, user_id, email, full_name, escort_code, status')
      .ilike('email', session.email)
      .limit(1)
      .maybeSingle();
    if (data) profile = data;
  }

  return profile;
}

async function studentIsOnEscortSchedule(
  supabase: any,
  studentId: string,
  escortKeys: string[]
): Promise<boolean> {
  if (!studentId || escortKeys.length === 0) return false;

  const { data: assignmentRows } = await supabase
    .from('escort_assignments')
    .select('id, status, escort_application_id')
    .eq('student_id', studentId)
    .in('status', LIVE_ASSIGNMENT_STATUSES)
    .limit(20);

  if ((assignmentRows || []).some((row: any) => assignmentBelongsToEscort(row, escortKeys))) {
    return true;
  }

  const uuidKeys = escortKeys.filter((id) => UUID_RE.test(id));
  const routeIds = new Set<string>();

  const { data: byAssignedEscort } = await supabase
    .from('transport_routes')
    .select('id')
    .in('assigned_escort_id', escortKeys)
    .limit(20);
  (byAssignedEscort || []).forEach((r: any) => {
    if (r.id) routeIds.add(r.id);
  });

  if (uuidKeys.length > 0) {
    const { data: byAssignedUser } = await supabase
      .from('transport_routes')
      .select('id')
      .in('assigned_escort_user_id', uuidKeys)
      .limit(20);
    (byAssignedUser || []).forEach((r: any) => {
      if (r.id) routeIds.add(r.id);
    });
  }

  if (routeIds.size > 0) {
    const { data: byRoute } = await supabase
      .from('student_route_assignments')
      .select('id, morning_route_id, afternoon_route_id, status')
      .eq('student_id', studentId)
      .limit(10);

    const onRoute = (byRoute || []).some((row: any) => {
      const live = row.status ? String(row.status).toLowerCase() !== 'cancelled' && String(row.status).toLowerCase() !== 'paused' : true;
      if (!live) return false;
      return routeIds.has(row.morning_route_id) || routeIds.has(row.afternoon_route_id);
    });
    if (onRoute) return true;
  }

  return false;
}

/**
 * POST /api/escorts/pickup-verify
 * Escort records doorstep pickup (morning) or doorstep drop-off (afternoon)
 * for a student, updating escort_student_daily_trips and notifying parents.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    const supabase = getAdminClient();

    let escortProfile: any = await resolveEscortProfile(supabase, session);

    if (!escortProfile && (process.env.NODE_ENV === 'development' || !session)) {
      const allApps = await getEscortApplications();
      if (allApps.length > 0) escortProfile = allApps[0];
    }

    if (!escortProfile && !session) {
      return NextResponse.json({ error: 'Unauthorized escort session' }, { status: 401 });
    }

    const escortId = escortProfile?.id || session?.user_id;
    const escortName = escortProfile?.full_name || escortProfile?.fullName || session?.full_name || 'Assigned Escort';

    const body = await request.json();
    const { school_id, action = 'morning_pickup', pin_code, scan_data, student_id_number } = body || {};
    let student_id = body?.student_id as string | undefined;
    const enteredPin = normalizePin(pin_code);
    const escortIdentifiers = escortScheduleKeys(escortProfile, session);
    const today = todayInLagos();

    if (scan_data || student_id_number) {
      const resolved = await resolveStudentIdAny(supabase, String(scan_data || student_id_number));
      if (!resolved) {
        return NextResponse.json({ error: 'Student ID card or number not recognized' }, { status: 404 });
      }
      student_id = resolved.id;
    }

    // Students without ID cards: parent shows the 4-digit phone code; escort enters it to board them.
    if (!student_id && enteredPin.length >= 4 && escortIdentifiers.length > 0) {
      const { data: assignments } = await supabase
        .from('escort_assignments')
        .select('id, student_id, booking_id, school_id, status')
        .in('escort_application_id', escortIdentifiers)
        .in('status', ['active', 'completed', 'pending_confirmation', 'pending']);

      const bookingIds = (assignments || []).map((a: any) => a.booking_id).filter(Boolean);
      let pinBookings: any[] = [];
      if (bookingIds.length > 0) {
        const { data } = await supabase
          .from('transport_bookings')
          .select('id, student_id, notes, school_id, status')
          .in('id', bookingIds);
        pinBookings = data || [];
      }

      const pinMatches = pinBookings.filter((b: any) => isTodayHandoverPin(b.notes, enteredPin, today));
      if (pinMatches.length > 1) {
        return NextResponse.json(
          { error: 'This parent phone code matches more than one student. Scan the ID or select the student from your list.' },
          { status: 409 }
        );
      }
      if (pinMatches.length === 1) {
        student_id = pinMatches[0].student_id;
      } else if (pinBookings.some((b: any) => extractHandoverPin(b.notes) === enteredPin)) {
        return NextResponse.json(
          { error: 'This code expired at midnight. Ask the parent to open Safety Connect and show today\'s code.' },
          { status: 403 }
        );
      }
    }

    if (!student_id) {
      return NextResponse.json(
        {
          error: enteredPin.length >= 4
            ? 'Parent phone code not recognized for your assigned students. Ask the parent to open Safety Connect and show the 4-digit code.'
            : 'Scan a student ID card, enter the student ID number, or enter the parent phone code',
        },
        { status: 400 }
      );
    }

    const timestamp = nowUtcIso();

    // Fetch student for school_id and name
    const { data: student } = await supabase
      .from('students')
      .select('id, first_name, last_name, school_id, student_id_number')
      .eq('id', student_id)
      .maybeSingle();

    const targetSchoolId = school_id || student?.school_id;
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'school_id could not be resolved' }, { status: 400 });
    }

    if (escortIdentifiers.length > 0) {
      const onEscortRoute = await studentIsOnEscortSchedule(supabase, student_id, escortIdentifiers);

      if (!onEscortRoute) {
        console.warn('[pickup-verify] schedule miss', {
          student_id,
          escort_keys: escortIdentifiers,
        });
        return NextResponse.json(
          { error: 'This student is not on your City Manager-approved schedule' },
          { status: 403 }
        );
      }
    }

    if (enteredPin.length >= 4) {
      const { data: pinAssignment } = await supabase
        .from('escort_assignments')
        .select('booking_id')
        .in('escort_application_id', escortIdentifiers.length ? escortIdentifiers : [escortId])
        .eq('student_id', student_id)
        .in('status', ['active', 'completed', 'pending_confirmation', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let pinNotes: unknown = null;
      if (pinAssignment?.booking_id) {
        const { data: pinBooking } = await supabase
          .from('transport_bookings')
          .select('notes')
          .eq('id', pinAssignment.booking_id)
          .maybeSingle();
        pinNotes = pinBooking?.notes;
      }
      if (!pinNotes) {
        const { data: studentBookings } = await supabase
          .from('transport_bookings')
          .select('notes')
          .eq('student_id', student_id)
          .order('created_at', { ascending: false })
          .limit(8);
        pinNotes = (studentBookings || []).find((b: any) => extractHandoverPin(b.notes))?.notes || null;
      }
      if (!extractHandoverPin(pinNotes)) {
        return NextResponse.json(
          { error: 'No parent phone code is on file for this student. Use scan, student ID, or 1-tap confirm.' },
          { status: 400 }
        );
      }
      if (!isTodayHandoverPin(pinNotes, enteredPin, today)) {
        const stored = extractHandoverPin(pinNotes);
        return NextResponse.json(
          {
            error:
              stored === enteredPin
                ? 'This code expired at midnight. Ask the parent to open Safety Connect and show today\'s code.'
                : 'Parent phone code does not match this student. Ask the parent to show today\'s code on their phone.',
          },
          { status: 403 }
        );
      }
    }

    const studentName = student ? `${student.first_name} ${student.last_name}` : 'Student';

    // Fetch existing trip record for today
    const { data: existingTrip } = await supabase
      .from('escort_student_daily_trips')
      .select('*')
      .eq('trip_date', today)
      .eq('student_id', student_id)
      .in('escort_id', escortIdentifiers.length ? escortIdentifiers : [escortId])
      .maybeSingle();

    let updatedTrip: any = null;

    if (action === 'morning_pickup') {
      if (existingTrip) {
        const { data, error } = await supabase
          .from('escort_student_daily_trips')
          .update({
            morning_picked_up: true,
            morning_picked_up_at: timestamp,
            morning_pin_verified: Boolean(pin_code),
            updated_at: timestamp,
          })
          .eq('id', existingTrip.id)
          .select()
          .single();
        if (error) throw error;
        updatedTrip = data;
      } else {
        const { data, error } = await supabase
          .from('escort_student_daily_trips')
          .insert({
            trip_date: today,
            escort_id: escortId,
            student_id,
            school_id: targetSchoolId,
            morning_picked_up: true,
            morning_picked_up_at: timestamp,
            morning_pin_verified: Boolean(pin_code),
            updated_at: timestamp,
          })
          .select()
          .single();
        if (error) throw error;
        updatedTrip = data;
      }

      // Notify parent about morning boarding
      const { data: parents } = await supabase
        .from('student_parents')
        .select('parent_user_id')
        .eq('student_id', student_id);

      if (parents && parents.length > 0) {
        const notifs = parents
          .filter((p: any) => p.parent_user_id)
          .map((p: any) => ({
            user_id: p.parent_user_id,
            school_id: targetSchoolId,
            student_id,
            title: `Safe Boarding: ${studentName}`,
            message: `${studentName} has safely boarded the MyEduRide vehicle with Escort ${escortName}. Transit to school is underway.`,
            type: 'escort_pickup',
            is_read: false,
          }));

        try {
          await supabase.from('notifications').insert(notifs);
        } catch (ne) {
          console.warn('[pickup-verify] notification notice:', ne);
        }
      }
    } else if (action === 'afternoon_dropoff') {
      if (existingTrip) {
        const { data, error } = await supabase
          .from('escort_student_daily_trips')
          .update({
            afternoon_dropped_off: true,
            afternoon_dropped_off_at: timestamp,
            updated_at: timestamp,
          })
          .eq('id', existingTrip.id)
          .select()
          .single();
        if (error) throw error;
        updatedTrip = data;
      } else {
        const { data, error } = await supabase
          .from('escort_student_daily_trips')
          .insert({
            trip_date: today,
            escort_id: escortId,
            student_id,
            school_id: targetSchoolId,
            afternoon_picked_up: true,
            afternoon_picked_up_at: timestamp,
            afternoon_dropped_off: true,
            afternoon_dropped_off_at: timestamp,
            updated_at: timestamp,
          })
          .select()
          .single();
        if (error) throw error;
        updatedTrip = data;
      }

      // Notify parent about afternoon safe arrival home
      const { data: parents } = await supabase
        .from('student_parents')
        .select('parent_user_id')
        .eq('student_id', student_id);

      if (parents && parents.length > 0) {
        const notifs = parents
          .filter((p: any) => p.parent_user_id)
          .map((p: any) => ({
            user_id: p.parent_user_id,
            school_id: targetSchoolId,
            student_id,
            title: `Safe Arrival Home: ${studentName}`,
            message: `${studentName} has safely arrived and been handed over at your doorstep by Escort ${escortName}.`,
            type: 'escort_dropoff',
            is_read: false,
          }));

        try {
          await supabase.from('notifications').insert(notifs);
        } catch (ne) {
          console.warn('[pickup-verify] notification notice:', ne);
        }
      }
    }

    return NextResponse.json({
      success: true,
      action,
      student_id,
      student_name: studentName,
      trip: updatedTrip,
      message: action === 'morning_pickup'
        ? `${studentName} pickup confirmed! Student is on board for morning transit.`
        : `${studentName} afternoon doorstep drop-off confirmed!`,
    });
  } catch (err: any) {
    console.error('[pickup-verify POST] error:', err);
    return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 500 });
  }
}
