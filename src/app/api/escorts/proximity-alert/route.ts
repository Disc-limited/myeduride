import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { calculateHaversineDistance } from '@/lib/platform/geofence';
import { todayInLagos } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

/**
 * POST /api/escorts/proximity-alert
 * Detects when an escort is approaching a student's house and automatically sends
 * a proximity notification to the parent with real-time distance and ETA.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    const body = await request.json();
    const {
      student_id,
      escort_id: passedEscortId,
      current_lat,
      current_lng,
      trip_phase = 'morning_pickup',
      threshold_meters = 1200,
    } = body;

    if (!student_id || current_lat == null || current_lng == null) {
      return NextResponse.json(
        { error: 'Missing required parameters: student_id, current_lat, current_lng' },
        { status: 400 }
      );
    }

    const escortId =
      passedEscortId ||
      session?.user_id ||
      'escort-current';

    const supabase = getAdminClient();
    const today = todayInLagos();

    // 1. Fetch student info and house coordinates
    const { data: student, error: stuErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, house_lat, house_lng, house_address, school_id')
      .eq('id', student_id)
      .maybeSingle();

    if (stuErr || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (student.house_lat == null || student.house_lng == null) {
      return NextResponse.json({
        triggered: false,
        reason: 'Student does not have pinned house GPS coordinates',
      });
    }

    // 2. Compute Haversine distance in meters
    const distanceMeters = calculateHaversineDistance(
      Number(current_lat),
      Number(current_lng),
      Number(student.house_lat),
      Number(student.house_lng)
    );

    const isWithinProximity = distanceMeters <= threshold_meters;

    // 3. Fetch existing daily trip record to check for deduplication
    const { data: dailyTrip } = await supabase
      .from('escort_student_daily_trips')
      .select('*')
      .eq('trip_date', today)
      .eq('escort_id', escortId)
      .eq('student_id', student_id)
      .maybeSingle();

    const alreadyNotified =
      trip_phase === 'afternoon_dropoff'
        ? Boolean(dailyTrip?.afternoon_proximity_notified_at)
        : Boolean(dailyTrip?.morning_proximity_notified_at);

    if (!isWithinProximity) {
      return NextResponse.json({
        triggered: false,
        is_within_threshold: false,
        distance_meters: Math.round(distanceMeters),
        threshold_meters,
        already_notified: alreadyNotified,
      });
    }

    if (alreadyNotified) {
      return NextResponse.json({
        triggered: false,
        is_within_threshold: true,
        already_notified: true,
        distance_meters: Math.round(distanceMeters),
        notified_at:
          trip_phase === 'afternoon_dropoff'
            ? dailyTrip?.afternoon_proximity_notified_at
            : dailyTrip?.morning_proximity_notified_at,
      });
    }

    // 4. Resolve Escort Name
    let escortName = session?.full_name || 'Escort';
    const { data: escortApp } = await supabase
      .from('escort_applications')
      .select('full_name')
      .or(`id.eq.${escortId},user_id.eq.${escortId}`)
      .maybeSingle();

    if (escortApp?.full_name) {
      escortName = escortApp.full_name;
    }

    const studentName = `${student.first_name} ${student.last_name}`.trim();
    // Estimate ETA based on average urban residential navigation speed (~240m/min)
    const etaMins = Math.max(1, Math.round(distanceMeters / 240));
    const roundedDist = Math.round(distanceMeters);
    const nowIso = new Date().toISOString();

    // 5. Fetch Parent Recipients
    const { data: parentLinks } = await supabase
      .from('student_parents')
      .select('parent_user_id')
      .eq('student_id', student_id);

    const parentUserIds = (parentLinks || []).map((p) => p.parent_user_id).filter(Boolean);

    // 6. Insert notification for parents & send Web Push
    if (parentUserIds.length > 0) {
      const notifs = parentUserIds.map((userId) => ({
        user_id: userId,
        school_id: student.school_id,
        student_id: student.id,
        title: `🚐 Escort Approaching: ${studentName}`,
        message: `Escort ${escortName} is now ~${etaMins} minute${etaMins > 1 ? 's' : ''} away (${roundedDist}m) from your house. Please have ${studentName} ready at the doorstep!`,
        type: 'escort_proximity',
        is_read: false,
      }));

      try {
        await supabase.from('notifications').insert(notifs);
      } catch (ne) {
        console.warn('[proximity-alert] notification insert note:', ne);
      }

      // Send Web Push to Parents
      const { sendPushToUser } = await import('@/lib/push/send');
      for (const parentId of parentUserIds) {
        try {
          await sendPushToUser(supabase, parentId, {
            title: `🚐 Escort Approaching (~${etaMins} mins)`,
            message: `${escortName} is ${roundedDist}m away. Please have ${studentName} ready at the doorstep!`,
            type: 'system',
            student_id,
            url: '/dashboard/parent?tab=live',
          });
        } catch (pe) {
          console.warn('[proximity-alert] push send note:', pe);
        }
      }

      // Broadcast on Realtime channel for Parent App live bell / audio chime
      try {
        const parentChannel = supabase.channel(`parent:student_${student_id}`);
        await parentChannel.send({
          type: 'broadcast',
          event: 'escort_proximity_5min',
          payload: {
            event: 'escort_proximity_5min',
            student_id,
            student_name: studentName,
            escort_id: escortId,
            escort_name: escortName,
            distance_meters: roundedDist,
            eta_minutes: etaMins,
            trip_phase,
            timestamp: nowIso,
          },
        });
      } catch (rtErr) {
        console.warn('[proximity-alert] parent realtime broadcast note:', rtErr);
      }
    }

    // 7. Update escort_student_daily_trips to record proximity notification timestamp
    const updatePayload =
      trip_phase === 'afternoon_dropoff'
        ? { afternoon_proximity_notified_at: nowIso, updated_at: nowIso }
        : { morning_proximity_notified_at: nowIso, updated_at: nowIso };

    if (dailyTrip) {
      await supabase
        .from('escort_student_daily_trips')
        .update(updatePayload)
        .eq('id', dailyTrip.id);
    } else {
      await supabase.from('escort_student_daily_trips').insert({
        trip_date: today,
        escort_id: escortId,
        student_id,
        school_id: student.school_id,
        ...updatePayload,
      });
    }

    return NextResponse.json({
      success: true,
      triggered: true,
      distance_meters: roundedDist,
      eta_minutes: etaMins,
      student_name: studentName,
      parents_notified_count: parentUserIds.length,
      message: `5-minute proximity notification successfully sent to ${parentUserIds.length} parent(s) (~${etaMins} mins / ${roundedDist}m away).`,
    });
  } catch (err: any) {
    console.error('[proximity-alert] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
