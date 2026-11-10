import { getAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/notifications/email-service';

export interface MonthlyGateCreditStatementData {
  schoolId: string;
  schoolName: string;
  reportMonth: string; // e.g. '2026-11'
  monthLabel: string; // e.g. 'November 2026'
  openingUnits: number;
  purchasedUnits: number;
  trialUnits: number;
  consumedUnits: number;
  closingUnits: number;
  totalClockIns: number;
  totalClockOuts: number;
  totalPurchasesNgn: number;
  totalConsumptionValueNgn: number;
  transactions: Array<{
    id: string;
    created_at: string;
    entry_type: string;
    person_name?: string | null;
    person_code?: string | null;
    person_role?: string | null;
    scan_type?: string | null;
    units_delta: number;
    units_after: number;
    amount_ngn: number;
    reference: string;
    description: string;
  }>;
}

export function renderMonthlyGateCreditStatementEmail(data: MonthlyGateCreditStatementData): string {
  const recentRows = data.transactions
    .slice(0, 40)
    .map((tx) => {
      const dateStr = new Date(tx.created_at).toLocaleString('en-NG', {
        timeZone: 'Africa/Lagos',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      const isPositive = tx.units_delta >= 0;
      const deltaBadge = isPositive
        ? `<span style="color:#059669;font-weight:700;">+${tx.units_delta.toFixed(1)} Units</span>`
        : `<span style="color:#dc2626;font-weight:700;">${tx.units_delta.toFixed(1)} Unit</span>`;

      return `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 8px;font-size:12px;color:#475569;">${dateStr}</td>
          <td style="padding:10px 8px;font-size:12px;color:#0f172a;font-weight:600;">${tx.description}</td>
          <td style="padding:10px 8px;font-size:12px;text-align:right;">${deltaBadge}</td>
          <td style="padding:10px 8px;font-size:12px;text-align:right;font-family:monospace;color:#0f172a;font-weight:700;">${tx.units_after.toFixed(1)} U</td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>MyEduRide Monthly Gate Credit Statement — ${data.monthLabel}</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:680px;margin:24px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(15,23,42,0.06);">
        <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);padding:28px 32px;color:#ffffff;">
          <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#34d399;margin-bottom:6px;">
            MYEDURIDE SCHOOL GATE MANAGER
          </div>
          <h1 style="margin:0;font-size:22px;font-weight:800;">Monthly Gate Credit Statement</h1>
          <p style="margin:6px 0 0;font-size:14px;color:#cbd5e1;">
            ${data.schoolName} &bull; ${data.monthLabel}
          </p>
        </div>

        <div style="padding:28px 32px;">
          <p style="margin:0 0 20px;font-size:14px;color:#334155;line-height:1.6;">
            Here is your official monthly summary of <strong>School Gate Credit Units</strong> purchased and utilized for student and staff clock-in/clock-out attendance at <strong>${data.schoolName}</strong>.
          </p>

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;">
              <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;">Purchased / Trial</div>
              <div style="font-size:20px;font-weight:800;color:#059669;margin-top:4px;">+${(data.purchasedUnits + data.trialUnits).toFixed(1)} U</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px;">₦${data.totalPurchasesNgn.toLocaleString()}</div>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;">
              <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;">Units Spent</div>
              <div style="font-size:20px;font-weight:800;color:#dc2626;margin-top:4px;">-${data.consumedUnits.toFixed(1)} U</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px;">${data.totalClockIns} In / ${data.totalClockOuts} Out</div>
            </div>
            <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:14px;">
              <div style="font-size:11px;color:#047857;font-weight:700;text-transform:uppercase;">Closing Balance</div>
              <div style="font-size:20px;font-weight:800;color:#065f46;margin-top:4px;">${data.closingUnits.toFixed(1)} Units</div>
              <div style="font-size:11px;color:#047857;margin-top:2px;">1 Unit = ₦6/day (In &amp; Out)</div>
            </div>
          </div>

          <h3 style="margin:0 0 12px;font-size:14px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;">
            Documented Credit Ledger (${data.transactions.length} Entries)
          </h3>

          <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#f1f5f9;border-bottom:1px solid #e2e8f0;">
                <th style="padding:10px 8px;text-align:left;font-size:11px;color:#475569;text-transform:uppercase;">Date</th>
                <th style="padding:10px 8px;text-align:left;font-size:11px;color:#475569;text-transform:uppercase;">Activity &amp; User</th>
                <th style="padding:10px 8px;text-align:right;font-size:11px;color:#475569;text-transform:uppercase;">Units</th>
                <th style="padding:10px 8px;text-align:right;font-size:11px;color:#475569;text-transform:uppercase;">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${recentRows || '<tr><td colspan="4" style="padding:16px;text-align:center;color:#64748b;font-size:13px;">No credit transactions recorded in this period.</td></tr>'}
            </tbody>
          </table>

          <div style="margin-top:24px;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;font-size:12px;color:#475569;">
            <strong>Unit Rate Breakdown:</strong> Every 1 complete unit (₦6.00/day) covers 1 Clock-In (0.5 Unit) and 1 Clock-Out (0.5 Unit) per user. Standard bundles: 25 Units (₦3,000), 50 Units (₦6,000), 100 Units (₦12,000).
          </div>
        </div>

        <div style="background:#f1f5f9;padding:16px 32px;text-align:center;font-size:12px;color:#64748b;">
          MyEduRide Institutional Safety &amp; Gate Manager Platform &bull; Automated Monthly Audit Report
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generates, persists, and dispatches (via Email + In-App Notification) the monthly
 * School Gate Credit Report for a school.
 */
export async function compileAndDispatchMonthlyGateCreditReport(params: {
  schoolId: string;
  reportMonth?: string; // 'YYYY-MM', defaults to current month in Lagos
  sendEmailReport?: boolean;
}) {
  const supabase = getAdminClient();
  const now = new Date();
  const defaultMonth = now.toISOString().slice(0, 7);
  const reportMonth = params.reportMonth || defaultMonth;

  const [yearStr, monthStr] = reportMonth.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1;
  const startDate = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

  const monthLabel = startDate.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .select('*')
    .eq('id', params.schoolId)
    .maybeSingle();

  if (schoolErr || !school) {
    throw new Error(schoolErr?.message || 'School not found');
  }

  const { data: ledgerRows } = await supabase
    .from('school_gate_credit_ledger')
    .select('*')
    .eq('school_id', params.schoolId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: false });

  const rows = ledgerRows || [];
  let purchasedMilli = 0;
  let trialMilli = 0;
  let consumedMilli = 0;
  let totalClockIns = 0;
  let totalClockOuts = 0;
  let totalPurchasesKobo = 0;

  for (const r of rows) {
    const delta = Number(r.units_delta_milli || 0);
    if (r.entry_type === 'PURCHASE' || r.entry_type === 'ADJUSTMENT_CREDIT') {
      purchasedMilli += Math.max(0, delta);
      totalPurchasesKobo += Number(r.amount_kobo || 0);
    } else if (r.entry_type === 'FREE_TRIAL') {
      trialMilli += Math.max(0, delta);
    } else if (r.entry_type === 'CONSUMPTION_SCAN' || r.entry_type === 'ADJUSTMENT_DEBIT') {
      consumedMilli += Math.abs(delta);
      if (r.scan_type === 'clock_in') totalClockIns++;
      if (r.scan_type === 'clock_out') totalClockOuts++;
    }
  }

  const oldestRow = rows.length > 0 ? rows[rows.length - 1] : null;
  const newestRow = rows.length > 0 ? rows[0] : null;
  const openingMilli = oldestRow ? Number(oldestRow.units_before_milli || 0) : Number(school.gate_credit_balance_milli || 0);
  const closingMilli = newestRow ? Number(newestRow.units_after_milli || 0) : Number(school.gate_credit_balance_milli || 0);

  // Resolve School Admin email recipients and user IDs for in-app notification
  const { data: adminRoles } = await supabase
    .from('user_school_roles')
    .select('user_id, user:user_profiles(email, full_name)')
    .eq('school_id', params.schoolId)
    .eq('role', 'school_admin')
    .eq('is_active', true);

  const recipientEmails = new Set<string>();
  const adminUserIds: string[] = [];
  if ((school as any).contact_email) recipientEmails.add((school as any).contact_email);
  if ((school as any).email) recipientEmails.add((school as any).email);

  for (const ar of adminRoles || []) {
    if (ar.user_id) adminUserIds.push(ar.user_id);
    const u: any = Array.isArray(ar.user) ? ar.user[0] : ar.user;
    if (u?.email) recipientEmails.add(u.email);
  }

  const statementData: MonthlyGateCreditStatementData = {
    schoolId: school.id,
    schoolName: school.name,
    reportMonth,
    monthLabel,
    openingUnits: Number((openingMilli / 1000).toFixed(1)),
    purchasedUnits: Number((purchasedMilli / 1000).toFixed(1)),
    trialUnits: Number((trialMilli / 1000).toFixed(1)),
    consumedUnits: Number((consumedMilli / 1000).toFixed(1)),
    closingUnits: Number((closingMilli / 1000).toFixed(1)),
    totalClockIns,
    totalClockOuts,
    totalPurchasesNgn: Math.round(totalPurchasesKobo / 100),
    totalConsumptionValueNgn: Math.round((consumedMilli / 1000) * 6),
    transactions: rows.map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      entry_type: r.entry_type,
      person_name: r.person_name,
      person_code: r.person_code,
      person_role: r.person_role,
      scan_type: r.scan_type,
      units_delta: Number((Number(r.units_delta_milli || 0) / 1000).toFixed(1)),
      units_after: Number((Number(r.units_after_milli || 0) / 1000).toFixed(1)),
      amount_ngn: Number((Number(r.amount_kobo || 0) / 100).toFixed(2)),
      reference: r.reference,
      description: r.description,
    })),
  };

  let emailSent = false;
  const emailList = Array.from(recipientEmails).filter(Boolean);

  if (params.sendEmailReport !== false && emailList.length > 0) {
    try {
      const html = renderMonthlyGateCreditStatementEmail(statementData);
      const res = await sendEmail({
        to: emailList,
        fromName: 'MyEduRide Gate Credit Audit',
        subject: `[MyEduRide] ${monthLabel} Gate Credit Statement — ${school.name}`,
        html,
      });
      emailSent = !!res.success;
    } catch (emailErr) {
      console.warn('[MonthlyGateCreditReport] Email dispatch warning:', emailErr);
    }
  }

  // Save report in school_gate_monthly_reports
  const { data: savedReport } = await supabase
    .from('school_gate_monthly_reports')
    .upsert(
      {
        school_id: school.id,
        report_month: reportMonth,
        opening_units_milli: openingMilli,
        purchased_units_milli: purchasedMilli,
        trial_units_milli: trialMilli,
        consumed_units_milli: consumedMilli,
        closing_units_milli: closingMilli,
        total_clock_ins: totalClockIns,
        total_clock_outs: totalClockOuts,
        total_amount_kobo: totalPurchasesKobo,
        recipient_emails: emailList,
        email_dispatched: emailSent,
        dispatched_at: emailSent ? new Date().toISOString() : null,
        report_payload: statementData,
      },
      { onConflict: 'school_id,report_month' }
    )
    .select()
    .maybeSingle();

  // Send In-App Notification to all School Admins for this school
  if (adminUserIds.length > 0) {
    const notifications = adminUserIds.map((uid) => ({
      user_id: uid,
      title: `Monthly Gate Credit Report (${monthLabel})`,
      message: `${school.name}: +${(statementData.purchasedUnits + statementData.trialUnits).toFixed(1)} Units added, -${statementData.consumedUnits.toFixed(1)} Units spent (${totalClockIns} Clock-Ins, ${totalClockOuts} Clock-Outs). Closing balance: ${statementData.closingUnits.toFixed(1)} Units.`,
      type: 'gate_credit_monthly_report',
      is_read: false,
    }));
    await supabase.from('notifications').insert(notifications).then(() => {});
  }

  return {
    report: savedReport,
    statement: statementData,
    emailSent,
    recipientEmails: emailList,
  };
}
