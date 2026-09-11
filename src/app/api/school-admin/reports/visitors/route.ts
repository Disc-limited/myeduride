// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAuthorizedSchoolAdmin } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { nowUtcIso, todayInLagos } from '@/lib/utils/time';
import { writeGateActivityLog } from '@/lib/gate/activity-log';
import { writeAuditLog } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function formatDuration(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return 'In Progress';
  if (mins < 60) return `${mins} mins`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * GET /api/school-admin/reports/visitors
 * 
 * Returns visitors ledger with time of visit, exit time, duration, purpose,
 * person to see, and action taken, with date & status filters.
 * Supports format=csv for report downloads.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const primarySchoolId =
      searchParams.get('school_id') ||
      (session as any).primary_school?.id ||
      session.roles?.find((r: any) => r.school_id)?.school_id;

    if (!primarySchoolId) {
      return NextResponse.json({ error: 'school_id could not be determined' }, { status: 400 });
    }

    if (!isAuthorizedSchoolAdmin(session, primarySchoolId)) {
      return NextResponse.json({ error: 'Access denied: School Admin role required' }, { status: 403 });
    }

    const supabase = getAdminClient();

    // Query parameters
    const singleDate = searchParams.get('date');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const statusFilter = searchParams.get('status') || 'all';
    const searchQuery = searchParams.get('search') || '';
    const format = searchParams.get('format') || 'json';

    let query = supabase
      .from('gate_visitors')
      .select('*')
      .eq('school_id', primarySchoolId)
      .order('entry_time', { ascending: false });

    // Date filtering
    if (singleDate) {
      const dayStart = `${singleDate}T00:00:00.000Z`;
      const dayEnd = `${singleDate}T23:59:59.999Z`;
      query = query.gte('entry_time', dayStart).lte('entry_time', dayEnd);
    } else if (startDate && endDate) {
      const rangeStart = `${startDate}T00:00:00.000Z`;
      const rangeEnd = `${endDate}T23:59:59.999Z`;
      query = query.gte('entry_time', rangeStart).lte('entry_time', rangeEnd);
    }

    const { data: dbVisitors, error } = await query;
    if (error) throw error;

    let visitors = dbVisitors || [];

    // Filter by status if specified
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'on_campus') {
        visitors = visitors.filter((v) => v.status === 'on_campus');
      } else if (statusFilter === 'departed') {
        visitors = visitors.filter((v) => v.status === 'departed');
      } else if (statusFilter === 'pending') {
        visitors = visitors.filter((v) => v.host_response === 'pending' || !v.host_response);
      } else if (statusFilter === 'accepted') {
        visitors = visitors.filter((v) => v.host_response === 'accepted');
      } else if (statusFilter === 'declined') {
        visitors = visitors.filter((v) => v.host_response === 'declined');
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      visitors = visitors.filter(
        (v) =>
          v.full_name?.toLowerCase().includes(q) ||
          v.phone?.includes(q) ||
          v.purpose_of_visit?.toLowerCase().includes(q) ||
          v.person_to_see?.toLowerCase().includes(q) ||
          v.department?.toLowerCase().includes(q) ||
          v.vehicle_plate?.toLowerCase().includes(q) ||
          v.digital_pass_token?.toLowerCase().includes(q)
      );
    }

    // Compute duration for currently on campus visitors if exit_time is null
    const nowTime = Date.now();
    const enrichedVisitors = visitors.map((v) => {
      let durationMins = v.duration_minutes;
      if (v.status === 'on_campus' && v.entry_time) {
        const entryMs = new Date(v.entry_time).getTime();
        durationMins = Math.max(1, Math.round((nowTime - entryMs) / 60000));
      }

      // Determine human action taken
      let actionTaken = 'Visitor Registered';
      if (v.host_response === 'accepted') {
        actionTaken = v.status === 'departed' ? 'Approved & Visit Completed' : 'Approved by Admin / Host (On Campus)';
      } else if (v.host_response === 'declined') {
        actionTaken = `Declined by Admin (${v.host_response_notes || 'Busy / Not Around'})`;
      } else if (v.status === 'departed') {
        actionTaken = 'Visit Completed & Checked Out';
      } else {
        actionTaken = 'Awaiting Admin / Host Clearance';
      }

      return {
        ...v,
        computed_duration_minutes: durationMins,
        duration_formatted: formatDuration(durationMins),
        action_taken: actionTaken,
      };
    });

    // Summary Metrics
    const totalVisits = enrichedVisitors.length;
    const currentlyOnCampus = enrichedVisitors.filter((v) => v.status === 'on_campus').length;
    const departedVisits = enrichedVisitors.filter((v) => v.status === 'departed').length;
    const awaitingAdminAction = enrichedVisitors.filter((v) => v.host_response === 'pending' || !v.host_response).length;
    const acceptedCount = enrichedVisitors.filter((v) => v.host_response === 'accepted').length;
    const declinedCount = enrichedVisitors.filter((v) => v.host_response === 'declined').length;

    const completedWithDuration = enrichedVisitors.filter((v) => v.duration_minutes != null);
    const avgDurationMins =
      completedWithDuration.length > 0
        ? Math.round(
            completedWithDuration.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0) /
              completedWithDuration.length
          )
        : 0;

    // Handle CSV format export
    if (format === 'csv') {
      const headers = [
        'Visitor Pass Token',
        'Visitor Name',
        'Phone Number',
        'Visitor Type',
        'Purpose of Visit',
        'Person to See',
        'Department',
        'Vehicle Plate',
        'Date of Visit',
        'Time of Entry',
        'Time of Exit',
        'Duration on Campus',
        'Campus Status',
        'Admin / Host Decision',
        'Decision Timestamp',
        'Decision Reason / Notes',
        'Security Flag',
        'Action Taken',
      ];

      const csvRows = [headers.map(escapeCsvCell).join(',')];

      for (const v of enrichedVisitors) {
        const entryDate = v.entry_time ? new Date(v.entry_time).toISOString().split('T')[0] : '';
        const entryTime = v.entry_time ? new Date(v.entry_time).toLocaleTimeString() : '';
        const exitTime = v.exit_time ? new Date(v.exit_time).toLocaleTimeString() : 'Still on Campus';

        const row = [
          v.digital_pass_token || v.id,
          v.full_name,
          v.phone,
          v.visitor_type || 'General Visitor',
          v.purpose_of_visit,
          v.person_to_see || 'General Admin',
          v.department || 'Administration',
          v.vehicle_plate || 'N/A',
          entryDate,
          entryTime,
          exitTime,
          v.duration_formatted,
          v.status === 'on_campus' ? 'On Campus' : 'Departed',
          v.host_response ? v.host_response.toUpperCase() : 'PENDING',
          v.host_response_at ? new Date(v.host_response_at).toLocaleString() : '',
          v.host_response_notes || '',
          v.security_flag || 'cleared',
          v.action_taken,
        ];
        csvRows.push(row.map(escapeCsvCell).join(','));
      }

      const csvContent = csvRows.join('\r\n');
      const filename = `visitors_report_${singleDate || todayInLagos()}.csv`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: nowUtcIso(),
      school_id: primarySchoolId,
      summary: {
        total_visitors: totalVisits,
        currently_on_campus: currentlyOnCampus,
        departed_count: departedVisits,
        awaiting_admin_action: awaitingAdminAction,
        accepted_count: acceptedCount,
        declined_count: declinedCount,
        average_duration_minutes: avgDurationMins,
        average_duration_formatted: formatDuration(avgDurationMins),
      },
      visitors: enrichedVisitors,
    });
  } catch (err: any) {
    console.error('[school-admin/reports/visitors GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/school-admin/reports/visitors
 * 
 * Allows School Admin to Accept or Decline visitors (e.g., if busy, not around, or approving entry).
 * Immediately commits to gate_visitors, notifies gate officers, and writes to audit logs.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { visitor_id, action, reason, notes, school_id } = body;

    const targetSchoolId =
      school_id ||
      (session as any).primary_school?.id ||
      session.roles?.find((r: any) => r.school_id)?.school_id;

    if (!targetSchoolId) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }

    if (!isAuthorizedSchoolAdmin(session, targetSchoolId)) {
      return NextResponse.json({ error: 'Access denied: School Admin role required' }, { status: 403 });
    }

    if (!visitor_id || !action) {
      return NextResponse.json({ error: 'visitor_id and action (accept/decline) are required' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // 1. Fetch current visitor record
    const { data: currentVisitor, error: findError } = await supabase
      .from('gate_visitors')
      .select('*')
      .eq('id', visitor_id)
      .eq('school_id', targetSchoolId)
      .single();

    if (findError || !currentVisitor) {
      return NextResponse.json({ error: 'Visitor record not found for this school' }, { status: 404 });
    }

    const isAccept = action === 'accept' || action === 'accepted';
    const hostDecision = isAccept ? 'accepted' : 'declined';
    const securityFlag = isAccept ? 'cleared' : 'flagged';
    const finalReason = notes || reason || (isAccept ? 'Approved by School Admin' : 'Admin not around / busy');
    const nowIso = nowUtcIso();

    // 2. Update gate_visitors
    const updateData = {
      host_response: hostDecision,
      host_response_at: nowIso,
      host_response_notes: finalReason,
      security_flag: securityFlag,
    };

    const { data: updatedVisitor, error: updateError } = await supabase
      .from('gate_visitors')
      .update(updateData)
      .eq('id', visitor_id)
      .eq('school_id', targetSchoolId)
      .select()
      .single();

    if (updateError) throw updateError;

    // 3. Write to Gate Activity Log
    await writeGateActivityLog(supabase, {
      school_id: targetSchoolId,
      gate_officer_user_id: session.user_id,
      action_type: 'manual_override',
      pickup_person_name: currentVisitor.full_name,
      pickup_person_phone: currentVisitor.phone,
      details: {
        event: isAccept ? 'VISITOR_ADMIN_ACCEPTED' : 'VISITOR_ADMIN_DECLINED',
        visitor_id: currentVisitor.id,
        digital_pass_token: currentVisitor.digital_pass_token,
        decision: hostDecision,
        decided_by_admin: session.user_id,
        reason: finalReason,
        purpose: currentVisitor.purpose_of_visit,
        person_to_see: currentVisitor.person_to_see,
      },
    });

    // 4. Write to Audit Log
    await writeAuditLog(supabase, {
      school_id: targetSchoolId,
      actor_user_id: session.user_id,
      action: isAccept ? 'gate_visitor_accepted_by_admin' : 'gate_visitor_declined_by_admin',
      entity_type: 'gate_visitors',
      entity_id: currentVisitor.id,
      details: {
        full_name: currentVisitor.full_name,
        phone: currentVisitor.phone,
        decision: hostDecision,
        reason: finalReason,
        timestamp: nowIso,
      },
    });

    // 5. Broadcast to Gate Officers via notifications
    try {
      await supabase.from('notifications').insert({
        school_id: targetSchoolId,
        title: isAccept
          ? `Visitor Cleared: ${currentVisitor.full_name}`
          : `Visitor Declined: ${currentVisitor.full_name}`,
        message: isAccept
          ? `School Admin APPROVED visitor ${currentVisitor.full_name}. Reason/Note: "${finalReason}". Please clear for entry.`
          : `School Admin DECLINED visitor ${currentVisitor.full_name}. Reason: "${finalReason}". Please inform visitor at the gate.`,
        type: 'visitor_access_update',
        priority: 'high',
        is_read: false,
        created_at: nowIso,
      });
    } catch (notifErr) {
      console.warn('[reports/visitors POST] Notification dispatch notice:', notifErr);
    }

    return NextResponse.json({
      success: true,
      message: isAccept
        ? `Visitor ${currentVisitor.full_name} APPROVED. Gate officer informed to clear entry.`
        : `Visitor ${currentVisitor.full_name} DECLINED (${finalReason}). Gate officer informed.`,
      visitor: updatedVisitor,
    });
  } catch (err: any) {
    console.error('[school-admin/reports/visitors POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
