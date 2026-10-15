/**
 * DAILY GATE DIGEST & ATTENDANCE INTELLIGENCE EMAIL TEMPLATE
 * 
 * Provides school executives with a consolidated morning & end-of-day digest:
 * 1. Executive KPIs (Student Attendance %, Staff Attendance %, Total Present/Absent).
 * 2. Gate System Daily Deduction Status (Settled, Already Deducted, or Insufficient Funds Alert).
 * 3. Class-by-Class Student Attendance Breakdown.
 * 4. Staff Sign-In & Absentee Audit.
 */

import { DailyRollCallReport } from '@/lib/attendance/daily-roll-call';
import { sendEmail } from '@/lib/notifications/email-service';

export interface GateDeductionSummary {
  success: boolean;
  status: 'DEDUCTED' | 'ALREADY_DEDUCTED' | 'INSUFFICIENT_FUNDS' | 'WAIVED_ZERO_FEE' | string;
  reference?: string;
  amount_ngn?: number;
  amount_kobo?: number;
  balance_after_ngn?: number;
  balance_before_ngn?: number;
  shortfall_ngn?: number;
  message?: string;
}

export function renderDailyGateDigestHtml(
  report: DailyRollCallReport,
  gateDeduction?: GateDeductionSummary
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://eduride.vercel.app';
  const shiftTitle =
    report.shift === 'morning'
      ? 'Morning Roll-Call & Gate Closure Report'
      : report.shift === 'afternoon'
      ? 'End-of-Day Operations & Dismissal Summary'
      : 'Full-Day Attendance & Gate Digest';

  const isDeductionSuccess = gateDeduction?.status === 'DEDUCTED' || gateDeduction?.status === 'ALREADY_DEDUCTED';
  const isInsufficientFunds = gateDeduction?.status === 'INSUFFICIENT_FUNDS';

  const feeAmountFormatted = gateDeduction?.amount_ngn != null
    ? `₦${gateDeduction.amount_ngn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
    : '₦2,500.00';

  const remainingBalanceFormatted = gateDeduction?.balance_after_ngn != null
    ? `₦${gateDeduction.balance_after_ngn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
    : null;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Gate Digest - ${report.school_name}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #334155;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 640px;
      margin: 30px auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 32px 28px;
      text-align: left;
      border-bottom: 3px solid #059669;
    }
    .brand-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .brand-name {
      color: #ffffff;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .brand-accent {
      color: #10b981;
    }
    .shift-badge {
      display: inline-block;
      background-color: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4px 10px;
      border-radius: 9999px;
    }
    .school-title {
      color: #f8fafc;
      font-size: 24px;
      font-weight: 800;
      margin: 12px 0 4px 0;
    }
    .date-subtitle {
      color: #94a3b8;
      font-size: 13px;
      margin: 0;
    }
    .content {
      padding: 28px;
    }
    .kpi-grid {
      display: table;
      width: 100%;
      margin-bottom: 24px;
      border-spacing: 8px;
    }
    .kpi-cell {
      display: table-cell;
      width: 50%;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      vertical-align: top;
    }
    .kpi-label {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 6px 0;
    }
    .kpi-value {
      font-size: 28px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      line-height: 1;
    }
    .kpi-sub {
      font-size: 12px;
      color: #475569;
      margin-top: 6px;
    }
    .kpi-highlight-green {
      color: #059669;
    }
    .kpi-highlight-blue {
      color: #2563eb;
    }
    .fee-box {
      border-radius: 12px;
      padding: 18px 20px;
      margin-bottom: 24px;
    }
    .fee-box-success {
      background-color: #f0fdf4;
      border: 1px solid #bbf7d0;
    }
    .fee-box-alert {
      background-color: #fff1f2;
      border: 1px solid #fecdd3;
    }
    .fee-box-waived {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
    }
    .fee-title {
      font-size: 14px;
      font-weight: 700;
      margin: 0 0 4px 0;
    }
    .fee-title-success { color: #15803d; }
    .fee-title-alert { color: #be123c; }
    .fee-title-waived { color: #475569; }
    .fee-meta {
      font-size: 12px;
      color: #334155;
      margin: 2px 0;
      line-height: 1.5;
    }
    .section-title {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 24px 0 12px 0;
      padding-bottom: 6px;
      border-bottom: 2px solid #e2e8f0;
    }
    .table-container {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 12px;
    }
    .table-container th {
      background-color: #f1f5f9;
      color: #475569;
      font-weight: 700;
      text-align: left;
      padding: 8px 10px;
      border-bottom: 1px solid #cbd5e1;
    }
    .table-container td {
      padding: 8px 10px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
    }
    .badge-present {
      display: inline-block;
      background-color: #dcfce7;
      color: #15803d;
      font-weight: 700;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .badge-absent {
      display: inline-block;
      background-color: #fee2e2;
      color: #b91c1c;
      font-weight: 700;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .cta-button {
      display: inline-block;
      background-color: #059669;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      padding: 12px 24px;
      border-radius: 8px;
      text-align: center;
      margin: 10px 0;
    }
    .btn-alert {
      background-color: #e11d48;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 28px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
    }
    .footer-link {
      color: #059669;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="brand-row">
        <h1 class="brand-name">MyEdu<span class="brand-accent">Ride</span> GateOS</h1>
        <span class="shift-badge">${shiftTitle}</span>
      </div>
      <div class="school-title">${report.school_name}</div>
      <p class="date-subtitle">Official Attendance & Access Digest • ${report.formatted_date}</p>
    </div>

    <!-- Main Content -->
    <div class="content">
      
      <!-- Gate Access Daily Deduction Card -->
      <div class="fee-box ${isDeductionSuccess ? 'fee-box-success' : isInsufficientFunds ? 'fee-box-alert' : 'fee-box-waived'}">
        <div class="fee-title ${isDeductionSuccess ? 'fee-title-success' : isInsufficientFunds ? 'fee-title-alert' : 'fee-title-waived'}">
          ${
            gateDeduction?.status === 'DEDUCTED'
              ? '✔ Gate System Daily Access Fee: Deducted'
              : gateDeduction?.status === 'ALREADY_DEDUCTED'
              ? '✔ Gate System Daily Access Fee: Already Settled'
              : isInsufficientFunds
              ? '⚠ Action Required: Low School Wallet Balance'
              : 'Gate System Daily Access Fee'
          }
        </div>
        <div class="fee-meta">
          <strong>Daily Access Rate:</strong> ${feeAmountFormatted} | 
          <strong>Billing Date:</strong> ${report.formatted_date}
        </div>
        ${
          gateDeduction?.reference
            ? `<div class="fee-meta"><strong>Ledger Reference:</strong> <code>${gateDeduction.reference}</code></div>`
            : ''
        }
        ${
          remainingBalanceFormatted
            ? `<div class="fee-meta"><strong>Wallet Available Balance:</strong> ${remainingBalanceFormatted}</div>`
            : ''
        }
        ${
          isInsufficientFunds
            ? `
            <p style="color: #be123c; font-size: 12px; margin: 8px 0 10px 0;">
              Your school wallet does not have sufficient funds to cover the daily gate access fee. 
              Kindly top up the school wallet to maintain uninterrupted gate scanning, biometric verification, and SMS alerts.
            </p>
            <a href="${appUrl}/dashboard/school-admin/wallet" class="cta-button btn-alert">Top Up School Wallet</a>
            `
            : ''
        }
      </div>

      <!-- KPI Executive Grid -->
      <div class="kpi-grid">
        <div class="kpi-cell">
          <div class="kpi-label">Student Attendance</div>
          <div class="kpi-value kpi-highlight-green">${report.students.attendance_rate_pct}%</div>
          <div class="kpi-sub">
            <strong>${report.students.total_present}</strong> Present / 
            <strong>${report.students.total_enrolled}</strong> Enrolled
          </div>
          <div class="kpi-sub" style="font-size: 11px; color: #64748b;">
            ${report.students.total_absent} Absent • ${report.students.total_late} Late
          </div>
        </div>
        <div class="kpi-cell">
          <div class="kpi-label">Staff Sign-In Rate</div>
          <div class="kpi-value kpi-highlight-blue">${report.staff.attendance_rate_pct}%</div>
          <div class="kpi-sub">
            <strong>${report.staff.total_present}</strong> Clocked In / 
            <strong>${report.staff.total_active}</strong> Active Staff
          </div>
          <div class="kpi-sub" style="font-size: 11px; color: #64748b;">
            ${report.staff.total_absent} Absent • ${report.staff.total_late} Late
          </div>
        </div>
      </div>

      <!-- Class Breakdown Table -->
      <div class="section-title">Student Attendance by Class</div>
      <table class="table-container">
        <thead>
          <tr>
            <th>Class / Grade</th>
            <th style="text-align: center;">Enrolled</th>
            <th style="text-align: center;">Present</th>
            <th style="text-align: center;">Absent</th>
            <th style="text-align: right;">Rate</th>
          </tr>
        </thead>
        <tbody>
          ${
            report.students.by_class.length === 0
              ? '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No active classes registered</td></tr>'
              : report.students.by_class
                  .map(
                    (c) => `
            <tr>
              <td><strong>${c.class_name}</strong></td>
              <td style="text-align: center;">${c.total_enrolled}</td>
              <td style="text-align: center;"><span class="badge-present">${c.total_present}</span></td>
              <td style="text-align: center;"><span class="${c.total_absent > 0 ? 'badge-absent' : 'badge-present'}">${c.total_absent}</span></td>
              <td style="text-align: right; font-weight: 700; color: ${c.attendance_rate_pct >= 90 ? '#059669' : c.attendance_rate_pct >= 75 ? '#d97706' : '#dc2626'};">${c.attendance_rate_pct}%</td>
            </tr>
          `
                  )
                  .join('')
          }
        </tbody>
      </table>

      <!-- Staff Clock-In Summary Table -->
      <div class="section-title">Staff Clock-In Status</div>
      <table class="table-container">
        <thead>
          <tr>
            <th>Staff Name</th>
            <th>Role</th>
            <th>Clock-In</th>
            <th style="text-align: right;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${
            report.staff.items.length === 0
              ? '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">No staff members registered</td></tr>'
              : report.staff.items
                  .slice(0, 15)
                  .map(
                    (st) => `
            <tr>
              <td><strong>${st.full_name}</strong></td>
              <td style="color:#64748b;">${st.role}</td>
              <td>${st.clock_in_time || '—'}</td>
              <td style="text-align: right;">
                <span class="${st.status === 'present' ? 'badge-present' : 'badge-absent'}">
                  ${st.status === 'present' ? (st.is_late ? 'Late' : 'Present') : 'Absent'}
                </span>
              </td>
            </tr>
          `
                  )
                  .join('')
          }
        </tbody>
      </table>

      <!-- Action Button -->
      <div style="text-align: center; margin-top: 24px;">
        <a href="${appUrl}/dashboard/school-admin/reports" class="cta-button">
          Open Full Analytics Console →
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div class="footer">
      <p style="margin: 0 0 6px 0;">
        Automated Gate System & Student Safety Dispatch • Generated at ${new Date(report.generated_at).toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos' })} (WAT)
      </p>
      <p style="margin: 0;">
        © ${new Date().getFullYear()} MyEduRide Platform Technologies. All rights reserved. 
        <a href="${appUrl}/privacy" class="footer-link">Privacy</a> • 
        <a href="${appUrl}/support" class="footer-link">Support</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Dispatches the formatted Daily Gate Digest email to school administrators.
 */
export async function sendDailyGateDigestEmail({
  to,
  report,
  gateDeduction,
}: {
  to: string | string[];
  report: DailyRollCallReport;
  gateDeduction?: GateDeductionSummary;
}) {
  const shiftLabel =
    report.shift === 'morning'
      ? '10:00 AM Morning Gate Roll-Call'
      : report.shift === 'afternoon'
      ? '6:00 PM Closing Digest'
      : 'Daily Gate Digest';

  const subject = `📋 ${report.school_name} - ${shiftLabel} (${report.students.attendance_rate_pct}% Student Attendance)`;
  const html = renderDailyGateDigestHtml(report, gateDeduction);

  return sendEmail({
    to,
    fromName: 'MyEduRide GateOS',
    subject,
    html,
  });
}
