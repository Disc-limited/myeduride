import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { todayInLagos, nowUtcIso } from '@/lib/timezone';
import { generateDailyRollCall } from '@/lib/attendance/daily-roll-call';
import {
  sendDailyGateDigestEmail,
  GateDeductionSummary,
} from '@/lib/notifications/email-templates/daily-gate-digest';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow sufficient time for multi-school aggregation & email delivery

/**
 * Validates request authorization:
 * 1. Bearer token matching CRON_SECRET
 * 2. x-cron-secret header matching CRON_SECRET
 * 3. Authenticated Super Admin session
 * 4. Permissive during local development if CRON_SECRET is not configured
 */
function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const xCronHeader = request.headers.get('x-cron-secret');

  if (cronSecret) {
    if (xCronHeader === cronSecret) return true;
    if (authHeader && authHeader === `Bearer ${cronSecret}`) return true;
  }

  // Super Admin session check
  const session = getSessionFromRequest(request);
  if (session && session.roles?.some((r) => r.role === 'super_admin')) {
    return true;
  }

  // Local development fallback
  if (process.env.NODE_ENV === 'development' && !cronSecret) {
    return true;
  }

  return false;
}

/**
 * Derives default shift based on current hour in Africa/Lagos (WAT, UTC+1).
 * Before 1:00 PM (13:00) -> 'morning' (10:00 AM Gate Closure)
 * 1:00 PM onwards -> 'afternoon' (6:00 PM School Dismissal)
 */
function resolveCurrentLagosShift(): 'morning' | 'afternoon' {
  const lagosHour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    hour: 'numeric',
    hour12: false,
  }).format(new Date());

  const hourNum = parseInt(lagosHour, 10);
  return hourNum < 13 ? 'morning' : 'afternoon';
}

/**
 * CRON WORKER: /api/cron/daily-gate-digest
 * 
 * Supports GET (Vercel Cron) and POST (Trigger / Test).
 * Query parameters:
 *   - school_id: Optional UUID to process a single school
 *   - date: Optional YYYY-MM-DD (defaults to today in Lagos)
 *   - shift: Optional 'morning' | 'afternoon'
 *   - skip_billing: Optional boolean to skip gate fee deduction
 */
async function handleDigest(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid CRON_SECRET or Super Admin session required' },
        { status: 401 }
      );
    }

    const sp = request.nextUrl.searchParams;
    const action = sp.get('action');

    // Return live in-process scheduler telemetry if requested (auto-starts if idle)
    if (action === 'status') {
      const { getSchedulerStatus, startInternalCronScheduler } = await import('@/lib/cron/scheduler');
      let currentStatus = getSchedulerStatus();
      if (!currentStatus.is_running) {
        startInternalCronScheduler();
        currentStatus = getSchedulerStatus();
      }
      return NextResponse.json({
        success: true,
        scheduler: currentStatus,
      });
    }

    const targetSchoolId = sp.get('school_id');
    const targetDate = sp.get('date') || todayInLagos();
    const explicitShift = sp.get('shift');
    const shift = (explicitShift === 'morning' || explicitShift === 'afternoon')
      ? explicitShift
      : resolveCurrentLagosShift();
    const skipBilling = sp.get('skip_billing') === 'true';

    const supabase = getAdminClient();

    // 1. Query schools to process
    let schoolQuery = supabase
      .from('schools')
      .select('id, name, daily_gate_fee_kobo, approval_status');

    if (targetSchoolId) {
      schoolQuery = schoolQuery.eq('id', targetSchoolId);
    } else {
      schoolQuery = schoolQuery.eq('approval_status', 'approved');
    }

    const { data: schools, error: schoolErr } = await schoolQuery;

    if (schoolErr) {
      return NextResponse.json({ error: schoolErr.message }, { status: 500 });
    }

    if (!schools || schools.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active schools found for digest processing',
        date: targetDate,
        shift,
        processed_count: 0,
        results: [],
      });
    }

    const results = [];

    // 2. Iterate each school and perform Gate Fee Deduction + Roll-Call + Dispatch
    for (const school of schools) {
      let gateDeduction: GateDeductionSummary = {
        success: true,
        status: 'SKIPPED',
        message: 'Billing skipped by request parameter',
      };

      // 2a. Execute Gate Fee Deduction via Stored Procedure
      if (!skipBilling) {
        try {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc(
            'execute_daily_school_gate_deduction',
            {
              p_school_id: school.id,
              p_date: targetDate,
            }
          );

          if (rpcErr) {
            console.error(`[Gate Digest] RPC billing error for school ${school.id}:`, rpcErr);
            gateDeduction = {
              success: false,
              status: 'RPC_ERROR',
              message: rpcErr.message,
            };
          } else if (rpcRes) {
            gateDeduction = rpcRes as GateDeductionSummary;
          }
        } catch (err: any) {
          console.error(`[Gate Digest] Stored procedure call failed:`, err);
          gateDeduction = {
            success: false,
            status: 'EXCEPTION',
            message: err?.message || 'Failed to execute gate deduction stored procedure',
          };
        }
      }

      // 2b. Generate Attendance Roll-Call Intelligence
      let report;
      try {
        report = await generateDailyRollCall({
          schoolId: school.id,
          dateStr: targetDate,
          shift,
          supabaseClient: supabase,
        });
      } catch (err: any) {
        console.error(`[Gate Digest] Roll-call failed for school ${school.id}:`, err);
        results.push({
          school_id: school.id,
          school_name: school.name,
          success: false,
          error: `Roll-call calculation failed: ${err?.message || err}`,
        });
        continue;
      }

      // 2c. Query Verified School Administrators for In-App & Email Dispatch
      const { data: adminRoles } = await supabase
        .from('user_school_roles')
        .select('user_id, user_profiles(full_name, email)')
        .eq('school_id', school.id)
        .eq('role', 'school_admin')
        .eq('is_active', true);

      const adminUserIds: string[] = [];
      const adminEmails: string[] = [];

      for (const ar of adminRoles || []) {
        if (ar.user_id) adminUserIds.push(ar.user_id);
        const profile: any = Array.isArray(ar.user_profiles) ? ar.user_profiles[0] : ar.user_profiles;
        if (profile?.email && !adminEmails.includes(profile.email)) {
          adminEmails.push(profile.email);
        }
      }

      // 2d. Insert In-App Notifications for School Admins
      let notificationsCreated = 0;
      const shiftLabel = shift === 'morning' ? '10:00 AM Morning Roll-Call' : '6:00 PM Closing Digest';
      const notificationTitle = `📋 Gate Digest (${shiftLabel}): ${report.students.attendance_rate_pct}% Attendance`;
      const notificationMessage = `Today's Summary: ${report.students.total_present}/${report.students.total_enrolled} students present (${report.students.total_absent} absent). Staff: ${report.staff.total_present}/${report.staff.total_active} signed in. Gate Fee: ${gateDeduction.status}.`;

      for (const adminId of adminUserIds) {
        try {
          await supabase.from('notifications').insert({
            user_id: adminId,
            school_id: school.id,
            title: notificationTitle,
            message: notificationMessage,
            type: 'daily_gate_digest',
            is_read: false,
            created_at: nowUtcIso(),
          });
          notificationsCreated++;
        } catch (notifErr) {
          console.warn(`[Gate Digest] Failed inserting in-app notification for admin ${adminId}:`, notifErr);
        }
      }

      // 2e. Dispatch Executive HTML Digest Email
      let emailDispatched = false;
      let emailError = null;

      if (adminEmails.length > 0) {
        try {
          const emailRes = await sendDailyGateDigestEmail({
            to: adminEmails,
            report,
            gateDeduction,
          });
          emailDispatched = !!emailRes?.success;
        } catch (emErr: any) {
          console.error(`[Gate Digest] Email dispatch failed for ${school.name}:`, emErr);
          emailError = emErr?.message || 'Email delivery failed';
        }
      }

      results.push({
        school_id: school.id,
        school_name: school.name,
        success: true,
        billing: {
          status: gateDeduction.status,
          reference: gateDeduction.reference,
          amount_ngn: gateDeduction.amount_ngn,
          balance_after_ngn: gateDeduction.balance_after_ngn,
          shortfall_ngn: gateDeduction.shortfall_ngn,
        },
        students: {
          enrolled: report.students.total_enrolled,
          present: report.students.total_present,
          absent: report.students.total_absent,
          rate_pct: report.students.attendance_rate_pct,
        },
        staff: {
          active: report.staff.total_active,
          present: report.staff.total_present,
          absent: report.staff.total_absent,
          rate_pct: report.staff.attendance_rate_pct,
        },
        notifications_sent: notificationsCreated,
        email: {
          recipients: adminEmails,
          sent: emailDispatched,
          error: emailError,
        },
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: nowUtcIso(),
      date: targetDate,
      shift,
      total_schools_processed: schools.length,
      results,
    });
  } catch (error: any) {
    console.error('[Gate Digest Cron Worker] Fatal error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error in gate digest worker' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleDigest(request);
}

export async function POST(request: NextRequest) {
  return handleDigest(request);
}
