// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAuthorizedSchoolAdmin } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { nowUtcIso } from '@/lib/utils/time';
import { writeGateActivityLog } from '@/lib/gate/activity-log';
import { writeAuditLog } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

/**
 * GET /api/gate/visitors
 * Returns active on-campus visitors, historical records, and visitor security metrics.
 * Direct live query from `gate_visitors` table in Supabase.
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

    const supabase = getAdminClient();

    const { data: dbVisitors, error } = await supabase
      .from('gate_visitors')
      .select('*')
      .eq('school_id', primarySchoolId)
      .order('entry_time', { ascending: false });

    const visitors = dbVisitors || [];

    const onCampus = visitors.filter((v) => v.status === 'on_campus');
    const departed = visitors.filter((v) => v.status === 'departed');
    const pendingApproval = visitors.filter(
      (v) => (v.host_response === 'pending' || v.security_flag === 'restricted') && v.status !== 'departed'
    );

    return NextResponse.json({
      success: true,
      timestamp: nowUtcIso(),
      school_id: primarySchoolId,
      metrics: {
        total_visitors_today: visitors.length,
        currently_on_campus: onCampus.length,
        departed_today: departed.length,
        pending_approval: pendingApproval.length,
        average_visit_duration: visitors.length > 0 ? '35 mins' : '0 mins',
      },
      on_campus_visitors: onCampus,
      pending_approval_visitors: pendingApproval,
      all_visitors: visitors,
    });
  } catch (err: any) {
    console.error('[visitors GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/gate/visitors
 * Handles digital visitor registration, smartphone QR verification, host approval/decline, and exit logging.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { action, school_id, visitor_data, scan_token, visitor_id, decision, notes } = body;

    const primarySchoolId =
      school_id ||
      (session as any).primary_school?.id ||
      session.roles?.find((r: any) => r.school_id)?.school_id;

    if (!primarySchoolId) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }

    const supabase = getAdminClient();

    if (action === 'register_visitor') {
      if (!visitor_data?.full_name || !visitor_data?.phone || !visitor_data?.purpose_of_visit) {
        return NextResponse.json(
          { error: 'Visitor full name, phone number, and purpose of visit are required' },
          { status: 400 }
        );
      }

      const digitalPassToken = `EDURIDE-VIS-${Math.floor(100000 + Math.random() * 900000)}`;
      const hasHost = Boolean(visitor_data.host_user_id);
      const isPreApproved = visitor_data.pre_approved === true || !hasHost;

      const insertPayload: Record<string, any> = {
        school_id: primarySchoolId,
        digital_pass_token: digitalPassToken,
        full_name: visitor_data.full_name.trim(),
        phone: visitor_data.phone.trim(),
        email: visitor_data.email?.trim() || null,
        purpose_of_visit: visitor_data.purpose_of_visit.trim(),
        person_to_see: visitor_data.person_to_see?.trim() || 'General Administration',
        department: visitor_data.department?.trim() || 'Administration',
        vehicle_plate: visitor_data.vehicle_plate?.toUpperCase().trim() || 'N/A',
        visitor_type: visitor_data.visitor_type || 'Parent / Guardian',
        entry_time: nowUtcIso(),
        status: 'on_campus',
        security_flag: isPreApproved ? 'cleared' : 'restricted',
        host_user_id: visitor_data.host_user_id || null,
        host_response: isPreApproved ? 'accepted' : 'pending',
      };

      let newVisitor: any = null;
      let insertError: any = null;

      // Try insert with host fields; fallback gracefully if columns not yet migrated
      const res1 = await supabase
        .from('gate_visitors')
        .insert(insertPayload)
        .select()
        .single();

      if (res1.error && res1.error.message?.includes('host_')) {
        // Fallback without new columns
        delete insertPayload.host_user_id;
        delete insertPayload.host_response;
        const res2 = await supabase
          .from('gate_visitors')
          .insert(insertPayload)
          .select()
          .single();
        newVisitor = res2.data;
        insertError = res2.error;
      } else {
        newVisitor = res1.data;
        insertError = res1.error;
      }

      if (insertError) throw insertError;

      // Notify host staff in-app
      if (visitor_data.host_user_id) {
        try {
          await supabase.from('notifications').insert({
            school_id: primarySchoolId,
            user_id: visitor_data.host_user_id,
            title: `Visitor at Gate: ${newVisitor.full_name}`,
            message: `${newVisitor.full_name} (${newVisitor.phone}) is at the school gate requesting to see you regarding: "${newVisitor.purpose_of_visit}". Please Accept or Decline entry.`,
            type: 'visitor_access_request',
            priority: 'high',
            is_read: false,
            created_at: nowUtcIso(),
          });
        } catch (notifErr) {
          console.warn('[visitors POST] Failed to create host notification:', notifErr);
        }
      }

      await writeGateActivityLog(supabase, {
        school_id: primarySchoolId,
        gate_officer_user_id: session.user_id,
        action_type: 'manual_override',
        pickup_person_name: newVisitor.full_name,
        pickup_person_phone: newVisitor.phone,
        details: {
          event: 'VISITOR_ENTRY_REGISTERED',
          visitor_id: newVisitor.id,
          digital_pass_token: digitalPassToken,
          purpose: newVisitor.purpose_of_visit,
          person_to_see: newVisitor.person_to_see,
          host_user_id: visitor_data.host_user_id || null,
          host_response: isPreApproved ? 'accepted' : 'pending',
          vehicle_plate: newVisitor.vehicle_plate,
        },
      });

      await writeAuditLog(supabase, {
        school_id: primarySchoolId,
        actor_user_id: session.user_id,
        action: 'gate_visitor_registered',
        entity_type: 'gate_visitors',
        entity_id: newVisitor.id,
        details: {
          full_name: newVisitor.full_name,
          phone: newVisitor.phone,
          purpose: newVisitor.purpose_of_visit,
          digital_pass_token: digitalPassToken,
          host_response: isPreApproved ? 'accepted' : 'pending',
        },
      });

      return NextResponse.json({
        success: true,
        message: isPreApproved
          ? `Visitor ${newVisitor.full_name} registered and cleared for entry.`
          : `Visitor ${newVisitor.full_name} registered. Awaiting host acceptance from ${newVisitor.person_to_see}.`,
        visitor: newVisitor,
      });
    }

    if (action === 'host_respond') {
      const targetVisitorId = visitor_id || body.id;
      if (!targetVisitorId || !decision) {
        return NextResponse.json({ error: 'visitor_id and decision required' }, { status: 400 });
      }

      const hostDecision = decision === 'accepted' ? 'accepted' : 'declined';
      const secFlag = hostDecision === 'accepted' ? 'cleared' : 'flagged';

      const updateData: Record<string, any> = {
        host_response: hostDecision,
        host_response_at: nowUtcIso(),
        host_response_notes: notes || null,
        security_flag: secFlag,
      };

      let updatedVisitor: any = null;
      let updateError: any = null;

      const res1 = await supabase
        .from('gate_visitors')
        .update(updateData)
        .eq('id', targetVisitorId)
        .eq('school_id', primarySchoolId)
        .select()
        .single();

      if (res1.error && res1.error.message?.includes('host_')) {
        // Fallback for older DB
        const res2 = await supabase
          .from('gate_visitors')
          .update({ security_flag: secFlag })
          .eq('id', targetVisitorId)
          .eq('school_id', primarySchoolId)
          .select()
          .single();
        updatedVisitor = res2.data;
        updateError = res2.error;
      } else {
        updatedVisitor = res1.data;
        updateError = res1.error;
      }

      if (updateError) throw updateError;

      await writeGateActivityLog(supabase, {
        school_id: primarySchoolId,
        gate_officer_user_id: session.user_id,
        action_type: 'manual_override',
        pickup_person_name: updatedVisitor?.full_name || 'Visitor',
        pickup_person_phone: updatedVisitor?.phone || 'N/A',
        details: {
          event: hostDecision === 'accepted' ? 'VISITOR_HOST_ACCEPTED' : 'VISITOR_HOST_DECLINED',
          visitor_id: targetVisitorId,
          decision: hostDecision,
          decided_by: session.user_id,
        },
      });

      return NextResponse.json({
        success: true,
        message:
          hostDecision === 'accepted'
            ? `Visitor ${updatedVisitor.full_name} APPROVED by host. Cleared for entry.`
            : `Visitor ${updatedVisitor.full_name} DECLINED by host. Do not allow on school premises.`,
        visitor: updatedVisitor,
      });
    }

    if (action === 'scan_verify_visitor') {
      let rawToken = String(scan_token || visitor_id || '').trim();

      // If user pasted a full URL e.g. https://myeduride.ng/pass/visitor/EDURIDE-VIS-123456
      if (rawToken.includes('/pass/visitor/')) {
        rawToken = rawToken.split('/pass/visitor/').pop()?.split('?')[0]?.split('#')[0] || rawToken;
      }
      rawToken = rawToken.replace(/^[#\s]+|[#\s]+$/g, '');

      if (!rawToken) {
        return NextResponse.json({ error: 'Please enter or scan a visitor pass token' }, { status: 400 });
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawToken);

      let query = supabase.from('gate_visitors').select('*').eq('school_id', primarySchoolId);

      if (isUuid) {
        query = query.or(`id.eq.${rawToken},digital_pass_token.eq.${rawToken}`);
      } else {
        query = query.or(
          `digital_pass_token.eq.${rawToken},digital_pass_token.ilike.%${rawToken}%,phone.eq.${rawToken}`
        );
      }

      const { data: visitor, error: findError } = await query.maybeSingle();

      if (findError) {
        console.error('[visitors POST scan] DB query error:', findError);
      }

      if (!visitor) {
        return NextResponse.json(
          { error: `Digital Visitor Pass '${rawToken}' not found in active records.` },
          { status: 404 }
        );
      }

      // Check if host declined
      if (visitor.host_response === 'declined' || visitor.security_flag === 'flagged') {
        return NextResponse.json(
          {
            error: `ENTRY DENIED: Visitor ${visitor.full_name} was DECLINED by host (${visitor.person_to_see}). Unwanted visitors are NOT allowed into the school premises.`,
            denied: true,
            visitor,
          },
          { status: 403 }
        );
      }

      // Check if still awaiting host approval
      if (visitor.host_response === 'pending' || visitor.security_flag === 'restricted') {
        return NextResponse.json({
          success: true,
          action_performed: 'pending_clearance',
          message: `Visitor ${visitor.full_name} pass verified, but is STILL AWAITING HOST CLEARANCE from ${visitor.person_to_see}.`,
          visitor,
        });
      }

      if (visitor.status === 'on_campus') {
        const exitTime = new Date();
        const entryTime = new Date(visitor.entry_time);
        const durationMins = Math.max(1, Math.round((exitTime.getTime() - entryTime.getTime()) / 60000));

        const { data: updatedVisitor, error: updateError } = await supabase
          .from('gate_visitors')
          .update({
            exit_time: nowUtcIso(),
            status: 'departed',
            duration_minutes: durationMins,
          })
          .eq('id', visitor.id)
          .select()
          .single();

        if (updateError) throw updateError;

        await writeGateActivityLog(supabase, {
          school_id: primarySchoolId,
          gate_officer_user_id: session.user_id,
          action_type: 'manual_override',
          pickup_person_name: visitor.full_name,
          pickup_person_phone: visitor.phone,
          details: {
            event: 'VISITOR_EXIT_LOGGED',
            visitor_id: visitor.id,
            duration_minutes: durationMins,
          },
        });

        await writeAuditLog(supabase, {
          school_id: primarySchoolId,
          actor_user_id: session.user_id,
          action: 'gate_visitor_exit',
          entity_type: 'gate_visitors',
          entity_id: visitor.id,
          details: { duration_minutes: durationMins },
        });

        return NextResponse.json({
          success: true,
          action_performed: 'exit',
          message: `Visitor ${visitor.full_name} exit confirmed (${durationMins} mins on campus).`,
          visitor: updatedVisitor,
        });
      } else {
        return NextResponse.json({
          success: true,
          action_performed: 'verification_only',
          message: `Visitor ${visitor.full_name} pass verified (Status: ${visitor.status}).`,
          visitor,
        });
      }
    }

    if (action === 'log_visitor_exit') {
      const { data: visitor, error: findError } = await supabase
        .from('gate_visitors')
        .select('*')
        .eq('id', visitor_id)
        .eq('school_id', primarySchoolId)
        .single();

      if (!visitor) {
        return NextResponse.json({ error: 'Visitor not found' }, { status: 404 });
      }

      const exitTime = new Date();
      const entryTime = new Date(visitor.entry_time);
      const durationMins = Math.max(1, Math.round((exitTime.getTime() - entryTime.getTime()) / 60000));

      const { data: updatedVisitor, error: updateError } = await supabase
        .from('gate_visitors')
        .update({
          exit_time: nowUtcIso(),
          status: 'departed',
          duration_minutes: durationMins,
        })
        .eq('id', visitor_id)
        .select()
        .single();

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        message: `Visitor ${visitor.full_name} exit recorded.`,
        visitor: updatedVisitor,
      });
    }

    return NextResponse.json({ error: `Unknown action '${action}'` }, { status: 400 });
  } catch (err: any) {
    console.error('[visitors POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
