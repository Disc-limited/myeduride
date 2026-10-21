// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAdminClient } from '@/lib/supabase/admin';
import { nowUtcIso, todayInLagos } from '@/lib/utils/time';
import { writeGateActivityLog } from '@/lib/gate/activity-log';
import { writeAuditLog } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

function formatDuration(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return 'In Progress';
  if (mins < 60) return `${mins} mins`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function computeTimeLeft(v: any, nowMs: number) {
  const isDeclined = v.host_response === 'declined' || v.security_flag === 'flagged';
  const isDeparted = v.status === 'departed';
  const isPending = v.host_response === 'pending' || !v.host_response;
  const isAccepted = v.host_response === 'accepted';
  const expectedLimit = Number(v.expected_duration_minutes) || 60;

  if (isDeclined) {
    return {
      time_left_minutes: 0,
      time_left_formatted: 'Declined',
      is_overdue: false,
      status_label: 'Entry Declined',
      status_color: 'rose',
    };
  }

  if (isDeparted) {
    const dur = v.duration_minutes || (v.exit_time && v.entry_time
      ? Math.max(1, Math.round((new Date(v.exit_time).getTime() - new Date(v.entry_time).getTime()) / 60000))
      : 30);
    return {
      time_left_minutes: 0,
      time_left_formatted: `Completed (${formatDuration(dur)})`,
      is_overdue: false,
      status_label: 'Visit Departed',
      status_color: 'slate',
    };
  }

  if (isPending) {
    return {
      time_left_minutes: expectedLimit,
      time_left_formatted: 'Awaiting Decision',
      is_overdue: false,
      status_label: 'Pending Acceptance',
      status_color: 'amber',
    };
  }

  // Active on campus & accepted
  const entryMs = v.entry_time ? new Date(v.entry_time).getTime() : nowMs;
  const elapsedMinutes = Math.max(0, Math.floor((nowMs - entryMs) / 60000));
  const remainingMinutes = expectedLimit - elapsedMinutes;

  if (remainingMinutes > 0) {
    const h = Math.floor(remainingMinutes / 60);
    const m = remainingMinutes % 60;
    const formatted = h > 0 ? `${h}h ${m}m left` : `${m}m left`;
    return {
      time_left_minutes: remainingMinutes,
      time_left_formatted: formatted,
      is_overdue: false,
      status_label: `${formatted} on campus`,
      status_color: remainingMinutes <= 15 ? 'amber' : 'emerald',
    };
  } else {
    const overdueMins = Math.abs(remainingMinutes);
    const h = Math.floor(overdueMins / 60);
    const m = overdueMins % 60;
    const formatted = h > 0 ? `Overstayed by ${h}h ${m}m` : `Overstayed by ${overdueMins}m`;
    return {
      time_left_minutes: remainingMinutes,
      time_left_formatted: formatted,
      is_overdue: true,
      status_label: formatted,
      status_color: 'rose',
    };
  }
}

/**
 * GET /api/staff/visitors
 * Fetches visitors assigned to current staff member (or all school visitors for school admin)
 * with time of visit, purpose of visit, and live calculated time left.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId =
      searchParams.get('school_id') ||
      session.roles?.find((r) => r.school_id)?.school_id ||
      (session as any).primary_school_id ||
      (session as any).primary_school?.id;

    if (!schoolId) {
      return NextResponse.json({ error: 'school_id could not be determined' }, { status: 400 });
    }

    const isAdmin = session.roles.some((r) => ['school_admin', 'super_admin'].includes(r.role));
    const scope = searchParams.get('scope') || (isAdmin ? 'all' : 'my');
    const statusFilter = searchParams.get('status') || 'all';
    const searchQuery = (searchParams.get('search') || '').toLowerCase().trim();

    const supabase = getAdminClient();

    let query = supabase
      .from('gate_visitors')
      .select('*')
      .eq('school_id', schoolId)
      .order('entry_time', { ascending: false });

    // If staff member (or scope=my), filter only visitors meant for them
    if (!isAdmin || scope === 'my') {
      const staffName = session.full_name?.trim();
      const staffFirstName = staffName ? staffName.split(' ')[0] : '';
      if (staffFirstName && staffFirstName.length > 2) {
        query = query.or(`host_user_id.eq.${session.user_id},person_to_see.ilike.%${staffName}%,person_to_see.ilike.%${staffFirstName}%`);
      } else {
        query = query.or(`host_user_id.eq.${session.user_id},person_to_see.ilike.%${staffName}%`);
      }
    }

    const { data: dbVisitors, error } = await query.limit(100);
    if (error) throw error;

    let visitors = dbVisitors || [];

    // Filter by status if specified
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        visitors = visitors.filter((v) => (v.host_response === 'pending' || !v.host_response) && v.status !== 'departed');
      } else if (statusFilter === 'on_campus') {
        visitors = visitors.filter((v) => v.status === 'on_campus' && v.host_response === 'accepted');
      } else if (statusFilter === 'departed') {
        visitors = visitors.filter((v) => v.status === 'departed');
      } else if (statusFilter === 'declined') {
        visitors = visitors.filter((v) => v.host_response === 'declined');
      }
    }

    // Filter by search query
    if (searchQuery) {
      visitors = visitors.filter((v) =>
        v.full_name?.toLowerCase().includes(searchQuery) ||
        v.phone?.includes(searchQuery) ||
        v.purpose_of_visit?.toLowerCase().includes(searchQuery) ||
        v.person_to_see?.toLowerCase().includes(searchQuery) ||
        v.department?.toLowerCase().includes(searchQuery) ||
        v.vehicle_plate?.toLowerCase().includes(searchQuery) ||
        v.digital_pass_token?.toLowerCase().includes(searchQuery)
      );
    }

    const nowMs = Date.now();
    const enriched = visitors.map((v) => {
      const timing = computeTimeLeft(v, nowMs);
      const entryDate = v.entry_time ? new Date(v.entry_time) : null;
      const exitDate = v.exit_time ? new Date(v.exit_time) : null;

      const timeOfVisit = entryDate
        ? `${entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${entryDate.toLocaleDateString([], { month: 'short', day: 'numeric' })})`
        : 'Time Pending';

      return {
        ...v,
        time_of_visit: timeOfVisit,
        exit_time_formatted: exitDate
          ? exitDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : null,
        purpose_of_visit: v.purpose_of_visit || 'General Visit',
        person_to_see: v.person_to_see || 'School Staff',
        department: v.department || 'Administration',
        vehicle_plate: v.vehicle_plate || 'N/A',
        expected_duration_minutes: Number(v.expected_duration_minutes) || 60,
        time_left_minutes: timing.time_left_minutes,
        time_left_formatted: timing.time_left_formatted,
        is_overdue: timing.is_overdue,
        status_label: timing.status_label,
        status_color: timing.status_color,
        can_decide: v.host_response === 'pending' || !v.host_response || isAdmin,
      };
    });

    const pendingCount = enriched.filter((v) => v.host_response === 'pending' || !v.host_response).length;
    const onCampusCount = enriched.filter((v) => v.status === 'on_campus' && v.host_response === 'accepted').length;
    const overdueCount = enriched.filter((v) => v.status === 'on_campus' && v.is_overdue).length;
    const departedCount = enriched.filter((v) => v.status === 'departed').length;

    return NextResponse.json({
      success: true,
      timestamp: nowUtcIso(),
      is_admin: isAdmin,
      scope,
      metrics: {
        total_count: enriched.length,
        pending_count: pendingCount,
        on_campus_count: onCampusCount,
        overdue_count: overdueCount,
        departed_count: departedCount,
      },
      visitors: enriched,
    });
  } catch (err: any) {
    console.error('[staff/visitors GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/staff/visitors
 * Allows staff or admin to Accept or Decline a visitor entry request and state a reason.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { visitor_id, action, reason, duration_minutes, school_id } = body;

    if (!visitor_id || !action) {
      return NextResponse.json({ error: 'visitor_id and action (accept/decline) are required' }, { status: 400 });
    }

    const decision = action === 'accept' || action === 'accepted' ? 'accepted' : 'declined';
    const isAccepted = decision === 'accepted';
    const finalReason = String(reason || (isAccepted ? 'Approved by staff host. Proceed to reception.' : 'Host is unavailable at this time.')).trim();
    const duration = Number(duration_minutes) || 60;

    const supabase = getAdminClient();

    // 1. Fetch current visitor
    const { data: currentVisitor, error: findError } = await supabase
      .from('gate_visitors')
      .select('*')
      .eq('id', visitor_id)
      .maybeSingle();

    if (findError || !currentVisitor) {
      return NextResponse.json({ error: 'Visitor record not found' }, { status: 404 });
    }

    const targetSchoolId = school_id || currentVisitor.school_id;
    const nowIso = nowUtcIso();

    // 2. Prepare update payload
    const updatePayload: Record<string, any> = {
      host_response: decision,
      host_response_at: nowIso,
      host_response_notes: finalReason,
      security_flag: isAccepted ? 'cleared' : 'flagged',
    };

    if (isAccepted) {
      updatePayload.expected_duration_minutes = duration;
      if (!currentVisitor.host_user_id) {
        updatePayload.host_user_id = session.user_id;
      }
    } else {
      updatePayload.decline_reason = finalReason;
    }

    // Attempt update with extra columns; fallback gracefully if migrations not yet run
    let updatedVisitor = null;
    let updateErr = null;

    const res1 = await supabase
      .from('gate_visitors')
      .update(updatePayload)
      .eq('id', visitor_id)
      .select()
      .maybeSingle();

    if (res1.error && res1.error.message?.includes('column')) {
      delete updatePayload.expected_duration_minutes;
      delete updatePayload.decline_reason;
      const res2 = await supabase
        .from('gate_visitors')
        .update(updatePayload)
        .eq('id', visitor_id)
        .select()
        .maybeSingle();
      updatedVisitor = res2.data;
      updateErr = res2.error;
    } else {
      updatedVisitor = res1.data;
      updateErr = res1.error;
    }

    if (updateErr) throw updateErr;

    // 3. Notify School Gate & Staff
    try {
      await supabase.from('notifications').insert({
        school_id: targetSchoolId,
        user_id: currentVisitor.registered_by || null,
        title: isAccepted
          ? `✅ Visitor ${currentVisitor.full_name} APPROVED`
          : `🚫 Visitor ${currentVisitor.full_name} DECLINED`,
        message: isAccepted
          ? `Host ${session.full_name} has APPROVED entry for visitor ${currentVisitor.full_name}. Pass cleared for ${duration} mins.`
          : `Host ${session.full_name} has DECLINED entry for visitor ${currentVisitor.full_name}. Reason: "${finalReason}". Do not allow entry.`,
        type: 'visitor_decision_update',
        priority: 'high',
        is_read: false,
        created_at: nowIso,
      });
    } catch (notifErr) {
      console.warn('[staff/visitors POST] Notification dispatch notice:', notifErr);
    }

    // 4. Log to Gate Activity and Audit Ledger
    await writeGateActivityLog(supabase, {
      school_id: targetSchoolId,
      gate_officer_user_id: session.user_id,
      action_type: 'manual_override',
      pickup_person_name: currentVisitor.full_name,
      pickup_person_phone: currentVisitor.phone || 'N/A',
      details: {
        event: isAccepted ? 'VISITOR_HOST_ACCEPTED' : 'VISITOR_HOST_DECLINED',
        visitor_id: currentVisitor.id,
        decision,
        decided_by_name: session.full_name,
        decided_by_id: session.user_id,
        reason: finalReason,
        duration_minutes: duration,
      },
    });

    await writeAuditLog(supabase, {
      school_id: targetSchoolId,
      actor_user_id: session.user_id,
      action: isAccepted ? 'gate_visitor_accepted' : 'gate_visitor_declined',
      entity_type: 'gate_visitors',
      entity_id: currentVisitor.id,
      details: {
        visitor_name: currentVisitor.full_name,
        decision,
        reason: finalReason,
        duration_minutes: duration,
      },
    });

    return NextResponse.json({
      success: true,
      message: isAccepted
        ? `Visitor ${currentVisitor.full_name} APPROVED. Entry cleared for ${duration} minutes.`
        : `Visitor ${currentVisitor.full_name} DECLINED. Reason: "${finalReason}". Gate informed.`,
      visitor: updatedVisitor || currentVisitor,
    });
  } catch (err: any) {
    console.error('[staff/visitors POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
