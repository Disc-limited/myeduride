import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAdminClient } from '@/lib/supabase/admin';
import { todayInLagos } from '@/lib/timezone';
import { nowUtcIso } from '@/lib/utils/time';
import { findEscortApplicationForSession } from '@/lib/escort/escort-category';
import {
  resolveStudentId,
  resolveStudentIdForEscort,
} from '@/lib/attendance/resolve-student';
import { extractHandoverPin, isTodayHandoverPin, normalizePin } from '@/lib/escort/handover-pin';
import { assertCanBoardStudent, getEscortBatchStatus } from '@/lib/escort/batch-capacity';

export const dynamic = 'force-dynamic';

/** Live assignments that authorize escort ID-card access */
const LIVE_ASSIGNMENT_STATUSES = ['active', 'pending_confirmation', 'pending'];
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

/** Fast and robust escort profile resolve matching dashboard-live */
async function resolveEscortProfile(supabase: any, session: any, studentId?: string) {
  if (!session) return null;

  // 1. Direct user_id match
  if (session.user_id) {
    const { data } = await supabase
      .from('escort_applications')
      .select('id, user_id, email, full_name, escort_code, status, school_id, primary_school_id, phone')
      .or(`id.eq.${session.user_id},user_id.eq.${session.user_id}`)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  // 2. Direct email match
  if (session.email) {
    const { data } = await supabase
      .from('escort_applications')
      .select('id, user_id, email, full_name, escort_code, status, school_id, primary_school_id, phone')
      .ilike('email', session.email)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  // 3. User profile attributes match (phone, username, email)
  if (session.user_id) {
    try {
      const { data: userProf } = await supabase
        .from('user_profiles')
        .select('email, phone, full_name, username')
        .eq('id', session.user_id)
        .maybeSingle();

      if (userProf) {
        const orFilters: string[] = [];
        if (userProf.email) orFilters.push(`email.ilike.${userProf.email}`);
        if (userProf.username) orFilters.push(`escort_code.ilike.${userProf.username}`);
        if (userProf.phone) {
          const cleanPhone = userProf.phone.replace(/[^0-9]/g, '');
          if (cleanPhone.length >= 8) orFilters.push(`phone.ilike.%${cleanPhone.slice(-8)}%`);
        }
        if (orFilters.length > 0) {
          const { data: profMatches } = await supabase
            .from('escort_applications')
            .select('id, user_id, email, full_name, escort_code, status, school_id, primary_school_id, phone')
            .or(orFilters.join(','))
            .limit(5);
          const hit = findEscortApplicationForSession(profMatches || [], session);
          if (hit) {
            if (session.user_id && hit.user_id !== session.user_id) {
              try {
                await supabase.from('escort_applications').update({ user_id: session.user_id, updated_at: nowUtcIso() }).eq('id', hit.id);
              } catch {}
            }
            return hit;
          }
        }
      }
    } catch (profErr) {
      console.warn('[pickup-verify] user_profile lookup note:', profErr);
    }
  }

  // 4. Target student assignment lookup
  if (studentId) {
    try {
      const { data: assignments } = await supabase
        .from('escort_assignments')
        .select('escort_application_id, status')
        .eq('student_id', studentId)
        .in('status', LIVE_ASSIGNMENT_STATUSES)
        .limit(5);

      const candidateAppIds = (assignments || []).map((a: any) => a.escort_application_id).filter(Boolean);
      if (candidateAppIds.length > 0) {
        const { data: assignedApps } = await supabase
          .from('escort_applications')
          .select('id, user_id, email, full_name, escort_code, status, school_id, primary_school_id, phone')
          .in('id', candidateAppIds);

        const hit = findEscortApplicationForSession(assignedApps || [], session);
        if (hit) {
          if (session.user_id && hit.user_id !== session.user_id) {
            try {
              await supabase.from('escort_applications').update({ user_id: session.user_id, updated_at: nowUtcIso() }).eq('id', hit.id);
            } catch {}
          }
          return hit;
        }

        if (assignedApps && assignedApps.length === 1) {
          const singleApp = assignedApps[0];
          const appNameFold = (singleApp.full_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const sessNameFold = (session.full_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (appNameFold && sessNameFold && (appNameFold.includes(sessNameFold) || sessNameFold.includes(appNameFold))) {
            if (session.user_id && singleApp.user_id !== session.user_id) {
              try {
                await supabase.from('escort_applications').update({ user_id: session.user_id, updated_at: nowUtcIso() }).eq('id', singleApp.id);
              } catch {}
            }
            return singleApp;
          }
        }
      }
    } catch (assignErr) {
      console.warn('[pickup-verify] student assignment lookup note:', assignErr);
    }
  }

  // 5. Comprehensive fallback matching across active applications (same as dashboard-live)
  try {
    const { data: allApps } = await supabase
      .from('escort_applications')
      .select('id, user_id, email, full_name, escort_code, status, school_id, primary_school_id, phone')
      .in('status', ['CITY_MANAGER_APPROVED', 'ACTIVE', 'ACTIVATED'])
      .limit(100);

    const hit = findEscortApplicationForSession(allApps || [], session);
    if (hit) {
      if (session.user_id && hit.user_id !== session.user_id) {
        try {
          await supabase.from('escort_applications').update({ user_id: session.user_id, updated_at: nowUtcIso() }).eq('id', hit.id);
        } catch {}
      }
      return hit;
    }
  } catch (err) {
    console.warn('[pickup-verify] fallback escort lookup error:', err);
  }

  return null;
}

/** Load student IDs on this escort's live roster (assignments + route stops). */
async function getEscortAssignedStudentIds(
  supabase: any,
  escortKeys: string[]
): Promise<{ studentIds: string[]; schoolIds: string[] }> {
  const studentIds = new Set<string>();
  const schoolIds = new Set<string>();
  if (!escortKeys.length) return { studentIds: [], schoolIds: [] };

  const { data: byAppId } = await supabase
    .from('escort_assignments')
    .select('student_id, school_id, escort_application_id, status')
    .in('escort_application_id', escortKeys)
    .in('status', LIVE_ASSIGNMENT_STATUSES)
    .limit(200);

  (byAppId || []).forEach((row: any) => {
    if (row.student_id) studentIds.add(String(row.student_id));
    if (row.school_id) schoolIds.add(String(row.school_id));
  });

  // School-escort route roster
  const { data: routes } = await supabase
    .from('transport_routes')
    .select('id, school_id, assigned_escort_id')
    .in('assigned_escort_id', escortKeys)
    .limit(40);

  const uuidKeys = escortKeys.filter((id) => UUID_RE.test(id));
  let routesByUser: any[] = [];
  if (uuidKeys.length > 0) {
    const { data } = await supabase
      .from('transport_routes')
      .select('id, school_id, assigned_escort_user_id')
      .in('assigned_escort_user_id', uuidKeys)
      .limit(40);
    routesByUser = data || [];
  }

  const allRoutes = [...(routes || []), ...routesByUser];
  const routeIds = allRoutes.map((r) => r.id).filter(Boolean);
  allRoutes.forEach((r) => {
    if (r.school_id) schoolIds.add(String(r.school_id));
  });

  if (routeIds.length > 0) {
    const { data: routeStudents } = await supabase
      .from('student_route_assignments')
      .select('student_id, morning_route_id, afternoon_route_id, status')
      .or(
        `morning_route_id.in.(${routeIds.join(',')}),afternoon_route_id.in.(${routeIds.join(',')})`
      )
      .limit(300);
    (routeStudents || []).forEach((row: any) => {
      const st = String(row.status || '').toLowerCase();
      if (st === 'cancelled' || st === 'paused') return;
      if (row.student_id) studentIds.add(String(row.student_id));
    });
  }

  return { studentIds: [...studentIds], schoolIds: [...schoolIds] };
}

async function studentIsOnEscortSchedule(
  supabase: any,
  studentId: string,
  escortKeys: string[],
  rosterStudentIds?: string[]
): Promise<boolean> {
  if (!studentId || escortKeys.length === 0) return false;
  if (rosterStudentIds?.includes(studentId)) return true;

  const { data: assignmentRows } = await supabase
    .from('escort_assignments')
    .select('id, status, escort_application_id, escort_id')
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
      const live =
        row.status
          ? String(row.status).toLowerCase() !== 'cancelled' &&
            String(row.status).toLowerCase() !== 'paused'
          : true;
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
 * Only students assigned to this escort can be scanned or verified.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized escort session' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { school_id, action = 'morning_pickup', pin_code, scan_data, student_id_number } = body || {};
    let student_id = body?.student_id as string | undefined;

    const supabase = getAdminClient();
    const escortProfile = await resolveEscortProfile(supabase, session, student_id);
    if (!escortProfile) {
      return NextResponse.json(
        { error: 'No escort profile linked to this login. Contact City Manager.' },
        { status: 403 }
      );
    }

    const escortId = escortProfile.id || session.user_id;
    const escortName =
      escortProfile.full_name || escortProfile.fullName || session.full_name || 'Assigned Escort';

    const enteredPin = normalizePin(pin_code);
    const escortIdentifiers = escortScheduleKeys(escortProfile, session);
    if (escortIdentifiers.length === 0) {
      return NextResponse.json({ error: 'Escort identity could not be verified' }, { status: 403 });
    }

    const today = todayInLagos();
    const roster = await getEscortAssignedStudentIds(supabase, escortIdentifiers);
    const allowedStudentIds = roster.studentIds;

    if (scan_data || student_id_number) {
      const scanRaw = String(scan_data || student_id_number);
      // Prefer school-scoped lookup when escort has a single school, else roster filter
      const preferredSchool =
        school_id ||
        escortProfile.primary_school_id ||
        escortProfile.school_id ||
        (roster.schoolIds.length === 1 ? roster.schoolIds[0] : null);

      let resolved =
        preferredSchool && allowedStudentIds.length > 0
          ? await resolveStudentIdForEscort(supabase, scanRaw, {
              allowedStudentIds,
              schoolId: preferredSchool,
            })
          : null;

      if (!resolved && allowedStudentIds.length > 0) {
        resolved = await resolveStudentIdForEscort(supabase, scanRaw, {
          allowedStudentIds,
        });
      }

      // If school known but roster empty (edge), still refuse global open resolve
      if (!resolved && preferredSchool) {
        const schoolHit = await resolveStudentId(supabase, preferredSchool, scanRaw);
        if (schoolHit && allowedStudentIds.includes(schoolHit)) {
          resolved = { id: schoolHit, school_id: preferredSchool };
        }
      }

      if (!resolved) {
        // Distinguish "unknown card" vs "not on your list" when possible
        if (preferredSchool) {
          const schoolOnly = await resolveStudentId(supabase, preferredSchool, scanRaw);
          if (schoolOnly) {
            return NextResponse.json(
              {
                error:
                  'This student is not assigned to you. You can only scan students on your City Manager / school roster.',
                code: 'not_assigned',
              },
              { status: 403 }
            );
          }
        }
        return NextResponse.json(
          {
            error:
              'Student ID not recognized for your assigned students. Check the card or select from your trip list.',
            code: 'not_found_or_not_assigned',
          },
          { status: 404 }
        );
      }
      student_id = resolved.id;
    }

    // Students without ID cards: parent shows the 4-digit phone code; escort enters it to board them.
    if (!student_id && enteredPin.length >= 4 && escortIdentifiers.length > 0) {
      const { data: assignments } = await supabase
        .from('escort_assignments')
        .select('id, student_id, booking_id, school_id, status')
        .in('escort_application_id', escortIdentifiers)
        .in('status', LIVE_ASSIGNMENT_STATUSES);

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
          {
            error:
              'This parent phone code matches more than one student. Scan the ID or select the student from your list.',
          },
          { status: 409 }
        );
      }
      if (pinMatches.length === 1) {
        student_id = pinMatches[0].student_id;
      } else if (pinBookings.some((b: any) => extractHandoverPin(b.notes) === enteredPin)) {
        return NextResponse.json(
          {
            error:
              "This code expired at midnight. Ask the parent to open Safety Connect and show today's code.",
          },
          { status: 403 }
        );
      }
    }

    if (!student_id) {
      return NextResponse.json(
        {
          error:
            enteredPin.length >= 4
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
      .select('id, first_name, last_name, school_id, student_id_number, is_active')
      .eq('id', student_id)
      .maybeSingle();

    if (!student || student.is_active === false) {
      return NextResponse.json({ error: 'Student not found or inactive' }, { status: 404 });
    }

    const targetSchoolId = school_id || student?.school_id;
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'school_id could not be resolved' }, { status: 400 });
    }

    // Fail closed: every path (scan, 1-tap student_id, PIN) must be on escort roster
    const onEscortRoute = await studentIsOnEscortSchedule(
      supabase,
      student_id,
      escortIdentifiers,
      allowedStudentIds
    );
    if (!onEscortRoute) {
      console.warn('[pickup-verify] schedule miss', {
        student_id,
        escort_keys: escortIdentifiers,
      });
      return NextResponse.json(
        {
          error:
            'This student is not assigned to you. Only City Manager / school-assigned students can be scanned.',
          code: 'not_assigned',
        },
        { status: 403 }
      );
    }

    if (enteredPin.length >= 4) {
      const { data: pinAssignment } = await supabase
        .from('escort_assignments')
        .select('booking_id')
        .in('escort_application_id', escortIdentifiers.length ? escortIdentifiers : [escortId])
        .eq('student_id', student_id)
        .in('status', LIVE_ASSIGNMENT_STATUSES)
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
          {
            error:
              'No parent phone code is on file for this student. Use scan, student ID, or 1-tap confirm.',
          },
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
    const capacityEscortIds = escortIdentifiers.length ? escortIdentifiers : [escortId];

    if (action === 'morning_pickup') {
      const capacity = await assertCanBoardStudent(supabase, {
        escortIds: capacityEscortIds,
        studentId: student_id,
        phase: 'morning',
        tripDate: today,
      });
      if (!capacity.ok) {
        return NextResponse.json(
          { error: capacity.error, batch: capacity.status, code: 'batch_full' },
          { status: 409 }
        );
      }
    }

    // Fetch existing trip record for today
    const { data: existingTrip } = await supabase
      .from('escort_student_daily_trips')
      .select('*')
      .eq('trip_date', today)
      .eq('student_id', student_id)
      .in('escort_id', capacityEscortIds)
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

    const batch = await getEscortBatchStatus(
      supabase,
      capacityEscortIds,
      action === 'afternoon_dropoff' ? 'afternoon' : 'morning',
      today
    );

    return NextResponse.json({
      success: true,
      action,
      student_id,
      student_name: studentName,
      trip: updatedTrip,
      batch,
      message: action === 'morning_pickup'
        ? `${studentName} is on your pickup list (${batch.on_board}/${batch.max_batch} on board).`
        : `${studentName} afternoon doorstep drop-off confirmed!`,
    });
  } catch (err: any) {
    console.error('[pickup-verify POST] error:', err);
    return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 500 });
  }
}
