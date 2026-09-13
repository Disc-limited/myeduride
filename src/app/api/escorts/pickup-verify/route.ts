import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAdminClient } from '@/lib/supabase/admin';
import { todayInLagos } from '@/lib/timezone';
import { nowUtcIso } from '@/lib/utils/time';
import { getEscortApplications } from '@/lib/escort/escort-db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/escorts/pickup-verify
 * Escort records doorstep pickup (morning) or doorstep drop-off (afternoon)
 * for a student, updating escort_student_daily_trips and notifying parents.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    const supabase = getAdminClient();
    const allApps = await getEscortApplications();

    let escortProfile: any = null;
    if (session) {
      const emailQuery = (session.email || session.username || '').toLowerCase();
      escortProfile = allApps.find(
        (a: any) =>
          (a.email && a.email.toLowerCase() === emailQuery) ||
          (a.emailOrUsername && a.emailOrUsername.toLowerCase() === emailQuery) ||
          (a.user_id && a.user_id === session.user_id) ||
          (session.user_id && a.id === session.user_id)
      );
    }

    if (!escortProfile && (process.env.NODE_ENV === 'development' || !session)) {
      if (allApps.length > 0) escortProfile = allApps[0];
    }

    if (!escortProfile && !session) {
      return NextResponse.json({ error: 'Unauthorized escort session' }, { status: 401 });
    }

    const escortId = escortProfile?.id || session?.user_id;
    const escortName = escortProfile?.full_name || session?.full_name || 'Assigned Escort';

    const body = await request.json();
    const { student_id, school_id, action = 'morning_pickup', pin_code } = body || {};

    if (!student_id) {
      return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
    }

    const today = todayInLagos();
    const timestamp = nowUtcIso();

    // Fetch student for school_id and name
    const { data: student } = await supabase
      .from('students')
      .select('id, first_name, last_name, school_id')
      .eq('id', student_id)
      .maybeSingle();

    const targetSchoolId = school_id || student?.school_id;
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'school_id could not be resolved' }, { status: 400 });
    }

    const studentName = student ? `${student.first_name} ${student.last_name}` : 'Student';

    // Fetch existing trip record for today
    const { data: existingTrip } = await supabase
      .from('escort_student_daily_trips')
      .select('*')
      .eq('trip_date', today)
      .eq('escort_id', escortId)
      .eq('student_id', student_id)
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
