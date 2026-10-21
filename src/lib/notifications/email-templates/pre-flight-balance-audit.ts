/**
 * PRE-FLIGHT BALANCE AUDIT & CREDIBILITY EMAIL TEMPLATES
 * 
 * Generates responsive, executive HTML email notifications for parents:
 * - Branch A: Credibility Confirmed (sufficient balance for next-day transport)
 * - Branch B: Top-Up Required Advisory (insufficient balance for next-day transport)
 */

import { sendEmail } from '@/lib/notifications/email-service';

export interface PreFlightEmailParams {
  parentName: string;
  parentEmail: string;
  targetDateFormatted: string; // e.g. "Monday, 19 October 2026" or "Tomorrow"
  dayLabel: string; // "Tomorrow" or "Monday"
  childrenNames: string; // "Emeka Eze and Chidinma Eze"
  childrenList: Array<{
    name: string;
    schoolName?: string;
    fareNgn: number;
  }>;
  availableBalanceNgn: number;
  totalRequiredFareNgn: number;
  shortfallNgn: number;
  isConfirmed: boolean;
  appUrl?: string;
}

export function renderPreFlightAuditEmailHtml(params: PreFlightEmailParams): string {
  const appUrl = params.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://myeduride.com';
  const fundWalletUrl = `${appUrl}/parent/wallet?action=fund&shortfall=${Math.ceil(params.shortfallNgn)}`;
  const dashboardUrl = `${appUrl}/parent/dashboard`;

  const formattedBalance = `₦${params.availableBalanceNgn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  const formattedFare = `₦${params.totalRequiredFareNgn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  const formattedShortfall = `₦${params.shortfallNgn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

  const brandGreen = '#1B4D3E';
  const brandGold = '#C5A059';
  const alertRed = '#DC2626';

  if (params.isConfirmed) {
    // -------------------------------------------------------------------------
    // BRANCH A: Credibility Confirmed
    // -------------------------------------------------------------------------
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Escort Credibility Confirmed</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #334155;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 600px;
      margin: 30px auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, ${brandGreen} 0%, #163e32 100%);
      padding: 32px 28px;
      text-align: left;
      border-bottom: 4px solid ${brandGold};
    }
    .badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background-color: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      margin-bottom: 12px;
    }
    .title {
      color: #ffffff;
      font-size: 22px;
      font-weight: 800;
      margin: 0 0 6px 0;
    }
    .subtitle {
      color: #cbd5e1;
      font-size: 14px;
      margin: 0;
    }
    .content {
      padding: 32px 28px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #e2e8f0;
      font-size: 14px;
    }
    .row:last-child {
      border-bottom: none;
    }
    .row-label {
      color: #64748b;
      font-weight: 500;
    }
    .row-value {
      font-weight: 700;
      color: #0f172a;
    }
    .highlight-green {
      color: #059669;
    }
    .btn {
      display: block;
      width: 100%;
      text-align: center;
      background-color: ${brandGreen};
      color: #ffffff !important;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 20px;
      border-radius: 10px;
      text-decoration: none;
      box-sizing: border-box;
      margin-top: 24px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 28px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">✅ Credibility Confirmed</div>
      <h1 class="title">Escort Pickup Confirmed</h1>
      <p class="subtitle">${params.targetDateFormatted} Scheduled School Transport</p>
    </div>
    <div class="content">
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-top: 0;">
        Dear <strong>${params.parentName || 'Parent'}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #475569;">
        Your wallet balance of <strong>${formattedBalance}</strong> is sufficient for tomorrow's scheduled school transport for <strong>${params.childrenNames}</strong>. Your escort pickup is fully confirmed.
      </p>

      <div class="summary-card">
        <div class="row">
          <span class="row-label">Scheduled Movement Date</span>
          <span class="row-value">${params.targetDateFormatted}</span>
        </div>
        <div class="row">
          <span class="row-label">Children En Route</span>
          <span class="row-value">${params.childrenNames}</span>
        </div>
        <div class="row">
          <span class="row-label">Tomorrow's Required Fare</span>
          <span class="row-value">${formattedFare}</span>
        </div>
        <div class="row">
          <span class="row-label">Current Available Balance</span>
          <span class="row-value highlight-green">${formattedBalance}</span>
        </div>
        <div class="row">
          <span class="row-label">Escrow Authorization Status</span>
          <span class="row-value highlight-green">Pre-Approved for 7:15 AM Cutoff</span>
        </div>
      </div>

      <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin-bottom: 0;">
        🔒 <strong>Peace of Mind Guarantee:</strong> Your children's assigned escort has received the confirmed transit manifest. You will receive live door-to-door notifications when transit begins in the morning.
      </p>

      <a href="${dashboardUrl}" class="btn">View Live Transport Dashboard</a>
    </div>
    <div class="footer">
      MyEduRide Safe School Transport System &bull; Lagos, Nigeria<br>
      Automated Night-Before Pre-Flight Balance Audit
    </div>
  </div>
</body>
</html>
`;
  }

  // ---------------------------------------------------------------------------
  // BRANCH B: Low Balance Top-Up Advisory
  // ---------------------------------------------------------------------------
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Top-Up Required: Fund Wallet for Tomorrow's Ride</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #334155;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 600px;
      margin: 30px auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
      border: 1px solid #fecaca;
    }
    .header {
      background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%);
      padding: 32px 28px;
      text-align: left;
      border-bottom: 4px solid #ef4444;
    }
    .badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background-color: #fee2e2;
      color: #991b1b;
      margin-bottom: 12px;
    }
    .title {
      color: #ffffff;
      font-size: 22px;
      font-weight: 800;
      margin: 0 0 6px 0;
    }
    .subtitle {
      color: #fca5a5;
      font-size: 14px;
      margin: 0;
    }
    .content {
      padding: 32px 28px;
    }
    .alert-banner {
      background-color: #fef2f2;
      border-left: 4px solid #ef4444;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-size: 14px;
      color: #991b1b;
      line-height: 1.5;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #e2e8f0;
      font-size: 14px;
    }
    .row:last-child {
      border-bottom: none;
    }
    .row-label {
      color: #64748b;
      font-weight: 500;
    }
    .row-value {
      font-weight: 700;
      color: #0f172a;
    }
    .highlight-red {
      color: #dc2626;
    }
    .btn {
      display: block;
      width: 100%;
      text-align: center;
      background-color: #dc2626;
      color: #ffffff !important;
      font-weight: 800;
      font-size: 16px;
      padding: 16px 20px;
      border-radius: 10px;
      text-decoration: none;
      box-sizing: border-box;
      margin-top: 24px;
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 28px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">⚠️ Action Required Tonight</div>
      <h1 class="title">Top-Up Required for Tomorrow's Ride</h1>
      <p class="subtitle">${params.targetDateFormatted} Scheduled School Transport</p>
    </div>
    <div class="content">
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-top: 0;">
        Dear <strong>${params.parentName || 'Parent'}</strong>,
      </p>

      <div class="alert-banner">
        <strong>⚠️ Urgent Funding Notice:</strong> Your MyEduRide balance is <strong>${formattedBalance}</strong>, which is below tomorrow's required fare of <strong>${formattedFare}</strong>. MyEduRide operates on daily funding—please top up your wallet tonight to avoid morning pickup disruption.
      </div>

      <div class="summary-card">
        <div class="row">
          <span class="row-label">Scheduled Movement Date</span>
          <span class="row-value">${params.targetDateFormatted}</span>
        </div>
        <div class="row">
          <span class="row-label">Children Scheduled</span>
          <span class="row-value">${params.childrenNames}</span>
        </div>
        <div class="row">
          <span class="row-label">Tomorrow's Required Fare</span>
          <span class="row-value">${formattedFare}</span>
        </div>
        <div class="row">
          <span class="row-label">Current Available Balance</span>
          <span class="row-value highlight-red">${formattedBalance}</span>
        </div>
        <div class="row" style="background-color: #fef2f2; margin: 4px -8px; padding: 10px 8px; border-radius: 6px;">
          <span class="row-label" style="color: #991b1b; font-weight: 700;">Top-Up Shortfall Needed</span>
          <span class="row-value highlight-red" style="font-size: 16px;">${formattedShortfall}</span>
        </div>
      </div>

      <p style="font-size: 13px; line-height: 1.5; color: #64748b;">
        ⚡ <strong>Instant Funding Available:</strong> You can fund your wallet in seconds via direct bank transfer to your dedicated virtual account or instantly via Debit Card / USSD.
      </p>

      <a href="${fundWalletUrl}" class="btn">Fund Wallet Now (${formattedShortfall})</a>
    </div>
    <div class="footer">
      MyEduRide Safe School Transport System &bull; Lagos, Nigeria<br>
      Automated Night-Before Pre-Flight Balance Audit
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Server helper to dispatch pre-flight balance audit email.
 */
export async function sendPreFlightAuditEmail(
  params: PreFlightEmailParams
): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    const html = renderPreFlightAuditEmailHtml(params);
    const subject = params.isConfirmed
      ? `✅ Escort Credibility Confirmed for Tomorrow`
      : `⚠️ Top-Up Required: Fund Wallet for Tomorrow's Ride`;

    const res = await sendEmail({
      to: params.parentEmail,
      fromName: 'MyEduRide Transport Dispatch',
      subject,
      html,
    });

    return { success: true, data: res };
  } catch (err: any) {
    console.error(`[PreFlight Email] Failed to send email to ${params.parentEmail}:`, err);
    return { success: false, error: err.message || err };
  }
}
