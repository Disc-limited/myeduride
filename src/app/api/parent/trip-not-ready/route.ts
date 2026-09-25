import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendPushToUser } from '@/lib/push/send';
import { todayInLagos, nowUtcIso } from '@/lib/utils/time';
import { invalidateOpsCache } from '@/lib/city-manager/ops-cache';

export const dynamic = 'force-dynamic';

export interface TripNotReadyEvent {
  event: 'student_not_ready';
  student_id: string;
  student_name: string;
  school_id?: string;
  school_name?: string;
  escort_id?: string;
  escort_name?: string;
  delay_minutes: number;
  reason: string;
  notes?: string;
  shifted_pickup_time: string;
  original_pickup_time?: string;
  timestamp: string;
  date: string;
}

/**
 * POST /api/parent/trip-not-ready
 * 
 * Invoked when a parent clicks "Not Ready Yet" on their portal.
 * Atomically:
 * 1. Resolves student, assigned escort, and school.
 * 2. Calculates the shifted pickup time (e.g. +10, +15, +20 mins).
 * 3. Updates/inserts escort_student_daily_trips with readiness_status='not_ready', delayed_minutes, shifted_pickup_time.
 * 4. Real-time broadcasts `student_not_ready` to the assigned escort's active channels.
 * 5. Sends high-priority in-app notification & push alert to the escort to skip/shift to the next ready child.
 * 6. Notifies City Manager & Gate control operations.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const body = await request.json();
    const {
      child_id,
      delay_minutes = 15,
      reason = 'Finishing preparation / almost ready',
      notes = '',
      trip_type = 'morning',
    } = body;

    if (!child_id) {
      return NextResponse.json({ error: 'Missing required field: child_id' }, { status: 400 });
    }

    const delayMins = Math.max(5, Math.min(60, Number(delay_minutes) || 15));
    const supabase = getAdminClient();
    const today = todayInLagos();
    const nowIso = nowUtcIso();

    // 1. Verify student exists and parent is authorized
    const { data: student, error: stuErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, school_id, house_address, house_lat, house_lng, class:school_classes(name), school:schools(name)')
      .eq('id', child_id)
      .maybeSingle();

    if (stuErr || !student) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
    const schoolObj = Array.isArray(student.school) ? student.school[0] : student.school;
    const schoolName = schoolObj?.name || 'School Campus';

    // 2. Resolve assigned Escort
    let escortId: string | null = null;
    let escortName: string | null = null;
    let escortUserId: string | null = null;

    try {
      const { data: escortAssign } = await supabase
        .from('escort_assignments')
        .select('escort_application_id, status, escort:escort_applications(id, full_name, user_id, phone)')
        .eq('student_id', child_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (escortAssign) {
        const e = Array.isArray(escortAssign.escort) ? escortAssign.escort[0] : escortAssign.escort;
        escortId = e?.id || escortAssign.escort_application_id || null;
        escortName = e?.full_name || 'Assigned Escort';
        escortUserId = e?.user_id || null;
      }
    } catch (eaErr) {
      console.warn('[trip-not-ready] escort_assignments query note:', eaErr);
    }

    if (!escortId) {
      try {
        const { data: booking } = await supabase
          .from('transport_bookings')
          .select('id, escort_id, assigned_escort_id, escort:escort_applications(id, full_name, user_id, phone)')
          .eq('student_id', child_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (booking) {
          const be = Array.isArray(booking.escort) ? booking.escort[0] : booking.escort;
          escortId = be?.id || booking.escort_id || booking.assigned_escort_id || null;
          escortName = be?.full_name || escortName;
          escortUserId = be?.user_id || escortUserId;
        }
      } catch (bkErr) {
        console.warn('[trip-not-ready] transport_bookings query note:', bkErr);
      }
    }

    // 3. Compute shifted pickup time
    const nowLocal = new Date();
    const shiftedDate = new Date(nowLocal.getTime() + delayMins * 60 * 1000);
    const shiftedTimeStr = shiftedDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    // 4. Atomically record in escort_student_daily_trips
    const { data: existingTrip } = await supabase
      .from('escort_student_daily_trips')
      .select('id, escort_id')
      .eq('student_id', child_id)
      .eq('trip_date', today)
      .maybeSingle();

    const tripPayload = {
      readiness_status: 'not_ready',
      is_not_ready_yet: true,
      delayed_minutes: delayMins,
      shifted_pickup_time: shiftedTimeStr,
      not_ready_reason: reason,
      not_ready_notes: notes || null,
      not_ready_at: nowIso,
      updated_at: nowIso,
    };

    if (existingTrip) {
      await supabase
        .from('escort_student_daily_trips')
        .update({
          ...tripPayload,
          ...(escortId && existingTrip.escort_id === 'unassigned' ? { escort_id: escortId } : {}),
        })
        .eq('id', existingTrip.id);
    } else {
      await supabase.from('escort_student_daily_trips').insert({
        trip_date: today,
        student_id: child_id,
        escort_id: escortId || 'unassigned',
        school_id: student.school_id,
        ...tripPayload,
      });
    }

    try {
      invalidateOpsCache();
    } catch {}

    // 5. Build Realtime Not Ready event
    const notReadyEvent: TripNotReadyEvent = {
      event: 'student_not_ready',
      student_id: child_id,
      student_name: studentName,
      school_id: student.school_id,
      school_name: schoolName,
      escort_id: escortId || undefined,
      escort_name: escortName || undefined,
      delay_minutes: delayMins,
      reason,
      notes: notes || undefined,
      shifted_pickup_time: shiftedTimeStr,
      timestamp: nowIso,
      date: today,
    };

    // Helper: broadcast WebSocket event
    const broadcastEvent = async (channelName: string) => {
      try {
        const ch = supabase.channel(channelName);
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            try { supabase.removeChannel(ch); } catch {}
            resolve();
          }, 3000);

          ch.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              ch.send({
                type: 'broadcast',
                event: 'student_not_ready',
                payload: notReadyEvent,
              })
                .then(() => {
                  clearTimeout(timeout);
                  setTimeout(() => {
                    try { supabase.removeChannel(ch); } catch {}
                    resolve();
                  }, 150);
                })
                .catch(() => {
                  clearTimeout(timeout);
                  try { supabase.removeChannel(ch); } catch {}
                  resolve();
                });
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              clearTimeout(timeout);
              try { supabase.removeChannel(ch); } catch {}
              resolve();
            }
          });
        });
      } catch (err) {
        console.warn(`[trip-not-ready] broadcast to ${channelName} note:`, err);
      }
    };

    // 6. Broadcast to Escort channels, Student Trip channel, and City Manager
    const channelsToNotify: string[] = [
      `student_trip:${child_id}`,
      `city_manager:operations`,
    ];
    if (escortId) channelsToNotify.push(`escort:${escortId}`);
    if (escortUserId) channelsToNotify.push(`escort:${escortUserId}`);
    if (student.school_id) channelsToNotify.push(`school_escorts:${student.school_id}`);

    await Promise.allSettled(channelsToNotify.map((ch) => broadcastEvent(ch)));

    // 7. Send high-priority in-app notification & Web Push to Escort
    const escortNotifyTargets = Array.from(new Set([escortUserId, escortId].filter(Boolean))) as string[];
    for (const targetUser of escortNotifyTargets) {
      try {
        await supabase.from('notifications').insert({
          user_id: targetUser,
          school_id: student.school_id,
          student_id: child_id,
          title: `⏳ Route Shift: ${studentName} (+${delayMins} mins)`,
          message: `Parent clicked "Not Ready Yet" (${reason}). Pickup shifted to ~${shiftedTimeStr}. Please proceed to pick up the next ready student in your route queue!`,
          type: 'trip_not_ready',
          is_read: false,
          created_at: nowIso,
        });
      } catch (ne) {
        console.warn('[trip-not-ready] escort notification insert note:', ne);
      }

      try {
        await sendPushToUser(supabase, targetUser, {
          title: `⏳ Route Shift: ${studentName} Not Ready`,
          message: `Requested +${delayMins}m delay (${reason}). Proceeding to next ready student!`,
          type: 'system',
          student_id: child_id,
          url: '/dashboard/escort',
          tag: `trip-not-ready-${child_id}`,
        });
      } catch (pe) {
        console.warn('[trip-not-ready] escort push notice:', pe);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Pickup shifted by ${delayMins} minutes. Escort has been notified to pick up other ready students first!`,
      student_id: child_id,
      student_name: studentName,
      delay_minutes: delayMins,
      shifted_pickup_time: shiftedTimeStr,
      escort_id: escortId,
      escort_user_id: escortUserId,
    });
  } catch (err: any) {
    console.error('[trip-not-ready] internal error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error while processing not ready status.' },
      { status: 500 }
    );
  }
}
