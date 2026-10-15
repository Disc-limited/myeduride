/**
 * IN-PROCESS AUTOMATED BACKGROUND CRON SCHEDULER
 * 
 * Runs silently inside the Node.js production container on PipeOps:
 * 1. Checks every 60 seconds against Africa/Lagos (WAT, UTC+1) time.
 * 2. Triggers Morning Roll-Call & Gate Deduction at 10:00 AM Lagos Time (Mon-Fri).
 * 3. Triggers Afternoon Dismissal Digest at 6:00 PM (18:00) Lagos Time (Mon-Fri).
 * 4. Dual-layer idempotency (in-memory execution tracker + database reference lock).
 * 5. Requires ZERO external cron services or third-party webhooks.
 */

import { todayInLagos, nowUtcIso } from '@/lib/timezone';
import { getAdminClient } from '@/lib/supabase/admin';
import { generateDailyRollCall } from '@/lib/attendance/daily-roll-call';
import {
  sendDailyGateDigestEmail,
  GateDeductionSummary,
} from '@/lib/notifications/email-templates/daily-gate-digest';

interface SchedulerState {
  isRunning: boolean;
  timer: NodeJS.Timeout | null;
  lastExecutedShiftKey: string | null;
  lastRunTimestamp: string | null;
  lastRunSummary: any | null;
}

const state: SchedulerState = {
  isRunning: false,
  timer: null,
  lastExecutedShiftKey: null,
  lastRunTimestamp: null,
  lastRunSummary: null,
};

/**
 * Returns current Lagos time components:
 * Day of week: 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
 */
function getLagosClockParts(): {
  dayOfWeek: number;
  hour: number;
  minute: number;
  dateStr: string;
} {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = dtf.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const dayOfWeek = weekdayMap[get('weekday')] ?? now.getDay();
  const hour = parseInt(get('hour'), 10);
  const minute = parseInt(get('minute'), 10);
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;

  return { dayOfWeek, hour, minute, dateStr };
}

/**
 * Core Execution Engine: Processes all active schools for the given shift.
 */
export async function executeScheduledDigestRun(shift: 'morning' | 'afternoon', dateStr = todayInLagos()) {
  console.log(`\n⏰ [In-Process Cron] Starting ${shift.toUpperCase()} Gate Digest execution for ${dateStr}...`);
  const supabase = getAdminClient();

  try {
    const { data: schools, error } = await supabase
      .from('schools')
      .select('id, name, daily_gate_fee_kobo, approval_status')
      .eq('approval_status', 'approved');

    if (error) {
      console.error('[In-Process Cron] Error querying schools:', error.message);
      return { success: false, error: error.message };
    }

    if (!schools || schools.length === 0) {
      console.log('[In-Process Cron] No approved schools found.');
      return { success: true, processed: 0 };
    }

    const processedResults = [];

    for (const school of schools) {
      let gateDeduction: GateDeductionSummary = {
        success: true,
        status: 'SKIPPED',
      };

      // 1. Gate Fee Deduction Stored Procedure
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc(
          'execute_daily_school_gate_deduction',
          {
            p_school_id: school.id,
            p_date: dateStr,
          }
        );

        if (rpcErr) {
          console.error(`[In-Process Cron] Billing error for ${school.name}:`, rpcErr.message);
          gateDeduction = { success: false, status: 'RPC_ERROR', message: rpcErr.message };
        } else if (rpcRes) {
          gateDeduction = rpcRes as GateDeductionSummary;
        }
      } catch (err: any) {
        console.error(`[In-Process Cron] Billing exception for ${school.name}:`, err.message);
        gateDeduction = { success: false, status: 'EXCEPTION', message: err.message };
      }

      // 2. Automated Roll-Call Intelligence
      try {
        const report = await generateDailyRollCall({
          schoolId: school.id,
          dateStr,
          shift,
          supabaseClient: supabase,
        });

        // 3. School Administrator In-App Notification
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

        const shiftLabel = shift === 'morning' ? '10:00 AM Morning Roll-Call' : '6:00 PM Closing Digest';
        for (const adminId of adminUserIds) {
          await supabase.from('notifications').insert({
            user_id: adminId,
            school_id: school.id,
            title: `📋 Gate Digest (${shiftLabel}): ${report.students.attendance_rate_pct}% Attendance`,
            message: `Today's Summary: ${report.students.total_present}/${report.students.total_enrolled} students present (${report.students.total_absent} absent). Staff: ${report.staff.total_present}/${report.staff.total_active} signed in. Gate Fee: ${gateDeduction.status}.`,
            type: 'daily_gate_digest',
            is_read: false,
            created_at: nowUtcIso(),
          });
        }

        // 4. Dispatch Email Report
        let emailSent = false;
        if (adminEmails.length > 0) {
          try {
            const emailRes = await sendDailyGateDigestEmail({
              to: adminEmails,
              report,
              gateDeduction,
            });
            emailSent = !!emailRes?.success;
          } catch (emErr: any) {
            console.warn(`[In-Process Cron] Email delivery failed for ${school.name}:`, emErr.message);
          }
        }

        processedResults.push({
          school_id: school.id,
          school_name: school.name,
          gate_deduction: gateDeduction.status,
          student_attendance_pct: report.students.attendance_rate_pct,
          staff_attendance_pct: report.staff.attendance_rate_pct,
          email_sent: emailSent,
        });
      } catch (rollCallErr: any) {
        console.error(`[In-Process Cron] Roll-call failed for ${school.name}:`, rollCallErr.message);
      }
    }

    const summary = {
      timestamp: nowUtcIso(),
      date: dateStr,
      shift,
      schools_processed: processedResults.length,
      details: processedResults,
    };

    state.lastRunTimestamp = nowUtcIso();
    state.lastRunSummary = summary;

    console.log(`✔ [In-Process Cron] Completed ${shift.toUpperCase()} digest run for ${processedResults.length} school(s).\n`);
    return { success: true, summary };
  } catch (err: any) {
    console.error('[In-Process Cron] Fatal execution error:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Tick handler executed once every 60 seconds.
 */
async function cronTick() {
  const { dayOfWeek, hour, minute, dateStr } = getLagosClockParts();

  // Only run Monday (1) to Friday (5)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return;
  }

  // Check 10:00 AM Lagos Time window (Morning Roll-Call & Daily Gate Access Fee Deduction)
  if (hour === 10 && minute === 0) {
    const shiftKey = `${dateStr}_morning`;
    if (state.lastExecutedShiftKey !== shiftKey) {
      state.lastExecutedShiftKey = shiftKey;
      await executeScheduledDigestRun('morning', dateStr);
    }
  }

  // Check 6:00 PM (18:00) Lagos Time window (Closing Operations & Student Dismissal Digest)
  if (hour === 18 && minute === 0) {
    const shiftKey = `${dateStr}_afternoon`;
    if (state.lastExecutedShiftKey !== shiftKey) {
      state.lastExecutedShiftKey = shiftKey;
      await executeScheduledDigestRun('afternoon', dateStr);
    }
  }
}

/**
 * Initializes and starts the background timer.
 */
export function startInternalCronScheduler() {
  if (state.isRunning) {
    console.log('ℹ [In-Process Cron] Scheduler already active.');
    return;
  }

  console.log('🚀 [In-Process Cron] Initializing MyEduRide Gate Digest in-process scheduler (Wat, Africa/Lagos)...');
  state.isRunning = true;

  // Run initial tick check after 10 seconds, then every 60 seconds
  setTimeout(() => {
    cronTick().catch((e) => console.error('[In-Process Cron] Initial tick error:', e));
  }, 10000);

  state.timer = setInterval(() => {
    cronTick().catch((e) => console.error('[In-Process Cron] Tick error:', e));
  }, 60000);

  console.log('✅ [In-Process Cron] Scheduler running: 10:00 AM & 6:00 PM Lagos Time (Mon-Fri).');
}

/**
 * Stops the scheduler (useful during graceful shutdown / testing).
 */
export function stopInternalCronScheduler() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  state.isRunning = false;
  console.log('🛑 [In-Process Cron] Scheduler stopped.');
}

/**
 * Returns current scheduler telemetry and health status.
 */
export function getSchedulerStatus() {
  const { dayOfWeek, hour, minute, dateStr } = getLagosClockParts();
  return {
    is_running: state.isRunning,
    server_time_utc: new Date().toISOString(),
    lagos_local_time: `${dateStr} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    current_weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
    is_weekday: dayOfWeek >= 1 && dayOfWeek <= 5,
    last_executed_shift_key: state.lastExecutedShiftKey,
    last_run_timestamp: state.lastRunTimestamp,
    last_run_summary: state.lastRunSummary,
  };
}
