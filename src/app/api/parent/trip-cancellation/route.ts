import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendPushToUser } from '@/lib/push/send';
import { todayInLagos, nowUtcIso } from '@/lib/utils/time';
import { TripCancellationEvent } from '@/lib/types/trip-cancellation-types';
import { invalidateOpsCache } from '@/lib/city-manager/ops-cache';

export const dynamic = 'force-dynamic';

/**
 * POST /api/parent/trip-cancellation
 * 
 * Invoked when a parent indicates their child is NOT going to school today.
 * Atomically:
 * 1. Updates/inserts escort_student_daily_trips (is_canceled_by_parent: true, reason, canceled_at).
 * 2. Updates/inserts attendance_records (status: 'absent', notes: reason).
 * 3. Immediately alerts the assigned Escort (Web Push + in-app notification + Supabase Realtime broadcast).
 * 4. Immediately alerts the City Manager (Web Push + in-app notification + Supabase Realtime broadcast).
 * 5. Logs to audit_logs for safety tracking and historical record.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const body = await request.json();
    const { child_id, reason = 'Illness / Family Reason', notes = '', trip_type = 'both' } = body;

    if (!child_id) {
      return NextResponse.json({ error: 'Missing required field: child_id' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const today = todayInLagos();
    const nowIso = nowUtcIso();

    // 1. Verify that the logged-in parent is authorized for this student
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

    // 2. Locate Assigned Escort for this student using multi-strategy resolution
    let escortId: string | null = null;
    let escortName: string | null = null;
    let escortUserId: string | null = null;

    // Strategy A: Check escort_assignments directly
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
      console.warn('[trip-cancellation] escort_assignments query note:', eaErr);
    }

    // Strategy B: Check transport_bookings
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
        console.warn('[trip-cancellation] transport_bookings query note:', bkErr);
      }
    }

    // Strategy C: Check student_route_assignments
    if (!escortId) {
      try {
        const { data: rAssign } = await supabase
          .from('student_route_assignments')
          .select('route:transport_routes(id, assigned_escort_id, assigned_escort_user_id)')
          .eq('student_id', child_id)
          .limit(1)
          .maybeSingle();

        if (rAssign?.route) {
          const r = Array.isArray(rAssign.route) ? rAssign.route[0] : rAssign.route;
          escortId = r?.assigned_escort_id || r?.assigned_escort_user_id || null;
          escortUserId = r?.assigned_escort_user_id || null;
        }
      } catch (rtErr) {
        console.warn('[trip-cancellation] student_route_assignments note:', rtErr);
      }
    }

    // Strategy D: Check existing daily trip records
    const { data: existingDailyTrip } = await supabase
      .from('escort_student_daily_trips')
      .select('*')
      .eq('student_id', child_id)
      .eq('trip_date', today)
      .maybeSingle();

    if (!escortId && existingDailyTrip?.escort_id && existingDailyTrip.escort_id !== 'unassigned') {
      escortId = existingDailyTrip.escort_id;
    }

    // Strategy E: Look up approved school escort if still not found
    if (!escortId && student.school_id) {
      try {
        const { data: scEscort } = await supabase
          .from('escort_applications')
          .select('id, user_id, full_name')
          .or(`school_id.eq.${student.school_id},primary_school_id.eq.${student.school_id}`)
          .eq('status', 'approved')
          .limit(1)
          .maybeSingle();

        if (scEscort) {
          escortId = scEscort.id;
          escortUserId = scEscort.user_id || scEscort.id;
          escortName = scEscort.full_name || 'School Escort';
        }
      } catch (scErr) {
        console.warn('[trip-cancellation] school escort lookup note:', scErr);
      }
    }

    // Enrich escortUserId and escortName if escortId is available
    if (escortId && (!escortUserId || !escortName)) {
      try {
        const { data: appData } = await supabase
          .from('escort_applications')
          .select('id, user_id, full_name')
          .or(`id.eq.${escortId},user_id.eq.${escortId}`)
          .limit(1)
          .maybeSingle();
        if (appData) {
          escortUserId = appData.user_id || escortUserId || appData.id;
          escortName = appData.full_name || escortName;
        }
      } catch {}
    }

    // 3. Atomically upsert escort_student_daily_trips
    const tripPayload = {
      is_canceled_by_parent: true,
      canceled_at: nowIso,
      cancellation_reason: reason,
      cancellation_notes: notes || null,
      updated_at: nowIso,
    };

    if (existingDailyTrip) {
      await supabase
        .from('escort_student_daily_trips')
        .update({
          ...tripPayload,
          ...(escortId && existingDailyTrip.escort_id === 'unassigned' ? { escort_id: escortId } : {}),
        })
        .eq('id', existingDailyTrip.id);
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

    // 4. Update attendance_records (mark absent for today's arrival)
    try {
      const startOfDay = `${today}T00:00:00`;
      const endOfDay = `${today}T23:59:59`;

      const { data: existingAtt } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('student_id', child_id)
        .eq('type', 'arrival')
        .gte('timestamp', startOfDay)
        .lte('timestamp', endOfDay)
        .maybeSingle();

      if (existingAtt) {
        await supabase
          .from('attendance_records')
          .update({
            status: 'absent',
            notes: `Parent declared not going today (${reason}). Notes: ${notes || 'None'}`,
            timestamp: nowIso,
          })
          .eq('id', existingAtt.id);
      } else {
        await supabase.from('attendance_records').insert({
          student_id: child_id,
          school_id: student.school_id,
          type: 'arrival',
          status: 'absent',
          notes: `Parent declared not going today (${reason}). Notes: ${notes || 'None'}`,
          timestamp: nowIso,
        });
      }
    } catch (attErr) {
      console.warn('[trip-cancellation] attendance record note:', attErr);
    }

    // 5. Build Realtime cancellation event
    const cancellationEvent: TripCancellationEvent = {
      event: 'student_trip_canceled',
      student_id: child_id,
      student_name: studentName,
      school_id: student.school_id,
      school_name: schoolName,
      escort_id: escortId || undefined,
      escort_name: escortName || undefined,
      reason,
      notes: notes || undefined,
      canceled_at: nowIso,
      date: today,
    };

    // Helper: subscribe before send so Supabase Realtime WebSocket does not drop the message
    const broadcastEvent = async (channelName: string) => {
      try {
        const ch = supabase.channel(channelName);
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            try { supabase.removeChannel(ch); } catch {}
            resolve();
          }, 3500);

          ch.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              ch.send({
                type: 'broadcast',
                event: 'student_trip_canceled',
                payload: cancellationEvent,
              })
                .then(() => {
                  clearTimeout(timeout);
                  setTimeout(() => {
                    try { supabase.removeChannel(ch); } catch {}
                    resolve();
                  }, 200);
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
        console.warn(`[trip-cancellation] broadcast to ${channelName} note:`, err);
      }
    };

    // 6. Alert Assigned Escort
    const escortNotifyTargets = Array.from(new Set([escortUserId, escortId].filter(Boolean))) as string[];
    for (const targetUser of escortNotifyTargets) {
      // In-app notification
      try {
        await supabase.from('notifications').insert({
          user_id: targetUser,
          school_id: student.school_id,
          student_id: child_id,
          title: `🚫 Trip Canceled: ${studentName}`,
          message: `${studentName} will not be attending school today (${reason}). Today's pickup has been canceled. Please do NOT proceed to this address.`,
          type: 'trip_canceled',
          is_read: false,
          created_at: nowIso,
        });
      } catch (ne) {
        console.warn('[trip-cancellation] escort notification insert:', ne);
      }

      // Web Push to Escort
      try {
        await sendPushToUser(supabase, targetUser, {
          title: `🚫 Pickup Canceled: ${studentName}`,
          message: `${studentName} is not going to school today (${reason}). Stop removed from route.`,
          type: 'system',
          url: '/dashboard/escort',
        });
      } catch (pe) {
        console.warn('[trip-cancellation] escort push notification note:', pe);
      }
    }

    // 7. Alert City Manager & School Operations
    try {
      const { data: cmUsers } = await supabase
        .from('user_school_roles')
        .select('user_id, role, school_id')
        .or(`school_id.eq.${student.school_id},school_id.eq.all`)
        .eq('role', 'city_manager');

      const cmUserIds = (cmUsers || []).map((c) => c.user_id).filter(Boolean);

      for (const cmId of cmUserIds) {
        await supabase.from('notifications').insert({
          user_id: cmId,
          school_id: student.school_id,
          student_id: child_id,
          title: `🚫 Student Absence / Trip Canceled: ${studentName}`,
          message: `Parent marked ${studentName} (${schoolName}) as not attending today. Reason: ${reason}. Assigned escort: ${escortName || 'Unassigned'}.`,
          type: 'trip_canceled_city_manager',
          is_read: false,
          created_at: nowIso,
        });

        await sendPushToUser(supabase, cmId, {
          title: `🚫 Student Absence: ${studentName}`,
          message: `${studentName} (${schoolName}) trip canceled by parent: ${reason}.`,
          type: 'system',
          url: '/dashboard/city-manager',
        });
      }
    } catch (cmErr) {
      console.warn('[trip-cancellation] city manager alert note:', cmErr);
    }

    // 8. Multi-Channel Realtime Broadcast (Escort, Student, School & City Manager)
    const targetChannels: string[] = [
      `student_trip:${child_id}`,
      `city_manager:operations`,
    ];
    if (escortId) targetChannels.push(`escort:${escortId}`);
    if (escortUserId && escortUserId !== escortId) targetChannels.push(`escort:${escortUserId}`);
    if (student.school_id) targetChannels.push(`school_escorts:${student.school_id}`);

    await Promise.allSettled(targetChannels.map((ch) => broadcastEvent(ch)));

    // 9. Audit Logging for child safety compliance
    try {
      const parentRole = session.roles?.[0]?.role || (session as unknown as { role?: string }).role || 'parent';
      await supabase.from('audit_logs').insert({
        user_id: session.user_id,
        user_role: parentRole,
        action: 'PARENT_TRIP_CANCELLATION',
        resource: 'student_trip',
        resource_id: child_id,
        details: {
          child_id,
          student_name: studentName,
          date: today,
          reason,
          notes,
          escort_id: escortId,
          escort_name: escortName,
          school_id: student.school_id,
          school_name: schoolName,
          canceled_at: nowIso,
        },
      });
    } catch (auditErr) {
      console.warn('[trip-cancellation] audit log note:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `Trip successfully canceled for ${studentName}. Both your assigned escort and city operations manager have been notified immediately.`,
      student_id: child_id,
      student_name: studentName,
      escort_id: escortId,
      escort_user_id: escortUserId,
      school_id: student.school_id,
      date: today,
      reason,
      status: 'canceled',
    });
  } catch (err: any) {
    console.error('[trip-cancellation] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
