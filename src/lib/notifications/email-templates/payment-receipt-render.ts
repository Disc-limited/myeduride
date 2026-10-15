/**
 * CLIENT & SERVER COMPATIBLE RECEIPT HTML RENDERER
 * 
 * Generates an institutional-grade, responsive HTML receipt invoice
 * with brand typography, transaction breakdown, and printable invoice styling.
 * 
 * Contains ZERO Node.js-only imports (no fs, net, nodemailer) so it can safely
 * be bundled into both Client Components (e.g. DigitalReceiptModal) and Server APIs.
 */

import { ReceiptData } from '@/lib/payments/receipt-engine';

export function renderPaymentReceiptHtml(receipt: ReceiptData): string {
  const formattedTotal = receipt.totalAmountNgn.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedNet = receipt.netAmountNgn.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedVat = receipt.vatAmountNgn.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedBalanceAfter =
    typeof receipt.balanceAfterNgn === 'number'
      ? `₦${receipt.balanceAfterNgn.toLocaleString('en-NG', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : null;

  const entitySubtitle =
    receipt.entityType === 'SCHOOL'
      ? 'Institutional School Account'
      : receipt.entityType === 'ESCORT'
      ? 'Verified Escort Account'
      : 'Parent Account';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt - ${receipt.receiptNumber}</title>
  <style>
    @page {
      size: auto;
      margin: 8mm;
    }
    @media print {
      html, body {
        background-color: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
        height: auto !important;
        overflow: visible !important;
      }
      .receipt-container {
        border: 1px solid #CBD5E1 !important;
        box-shadow: none !important;
        max-width: 100% !important;
        width: 100% !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1E293B; -webkit-font-smoothing: antialiased;">
  <table role="presentation" class="receipt-container" width="100%" cellpadding="0" cellspacing="0" style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);">
    
    <!-- BRAND HEADER -->
    <tr>
      <td style="padding: 28px 32px; background: linear-gradient(135deg, #0A1128 0%, #101F42 100%); text-align: left;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <div style="display: inline-block; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; color: #FFFFFF;">
                My<span style="color: #10B981;">Edu</span>Ride
              </div>
              <div style="font-size: 11px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px;">
                The Student Safety & Mobility Network
              </div>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <span style="display: inline-block; background-color: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34D399; font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.8px;">
                Official Receipt
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- RECEIPT HERO / TOTAL PAID -->
    <tr>
      <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #F1F5F9; background-color: #FAFDFB;">
        <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 50%; background-color: #ECFDF5; color: #059669; font-size: 22px; margin-bottom: 12px; border: 1px solid #A7F3D0;">
          ✓
        </div>
        <div style="font-size: 12px; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 6px;">
          Deposit Successful & Credited
        </div>
        <div style="font-size: 34px; font-weight: 900; color: #0A1128; letter-spacing: -1px; margin: 0;">
          ₦${formattedTotal}
        </div>
        <div style="margin-top: 8px; font-size: 12px; color: #64748B;">
          Receipt No: <strong style="color: #0F172A; font-family: monospace; font-size: 13px;">${receipt.receiptNumber}</strong>
        </div>
      </td>
    </tr>

    <!-- ENTITY & TRANSACTION DETAILS GRID -->
    <tr>
      <td style="padding: 24px 32px; background-color: #FFFFFF;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
          <tr>
            <!-- BILLED TO -->
            <td style="width: 50%; vertical-align: top; padding-right: 12px;">
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94A3B8; letter-spacing: 1px; margin-bottom: 6px;">
                Billed To
              </div>
              <div style="font-size: 14px; font-weight: 800; color: #0F172A; margin-bottom: 2px;">
                ${receipt.entityName}
              </div>
              <div style="font-size: 12px; color: #64748B; margin-bottom: 2px;">
                ${entitySubtitle}
              </div>
              <div style="font-size: 12px; color: #475569; word-break: break-all;">
                ${receipt.userEmail}
              </div>
              ${
                receipt.userPhone
                  ? `<div style="font-size: 12px; color: #475569; margin-top: 2px;">${receipt.userPhone}</div>`
                  : ''
              }
            </td>

            <!-- PAYMENT INFO -->
            <td style="width: 50%; vertical-align: top; padding-left: 12px;">
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94A3B8; letter-spacing: 1px; margin-bottom: 6px;">
                Payment Info
              </div>
              <div style="font-size: 12px; color: #64748B; margin-bottom: 4px;">
                Date: <strong style="color: #0F172A;">${receipt.timestamp}</strong>
              </div>
              <div style="font-size: 12px; color: #64748B; margin-bottom: 4px;">
                Method: <strong style="color: #0F172A;">${receipt.paymentMethod}</strong>
              </div>
              <div style="font-size: 12px; color: #64748B; margin-bottom: 4px;">
                Channel: <strong style="color: #0F172A;">SeerBit Secure Vault</strong>
              </div>
            </td>
          </tr>
        </table>

        <!-- REFERENCES BOX -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0; padding: 10px 14px; margin-bottom: 24px;">
          <tr>
            <td style="font-size: 11px; color: #64748B; padding: 4px 0;">
              Tx Reference: <strong style="color: #0F172A; font-family: monospace;">${receipt.transactionReference}</strong>
            </td>
          </tr>
          <tr>
            <td style="font-size: 11px; color: #64748B; padding: 4px 0;">
              Gateway Ref: <strong style="color: #0F172A; font-family: monospace;">${receipt.gatewayReference}</strong>
            </td>
          </tr>
        </table>

        <!-- ITEMIZED INVOICE TABLE -->
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94A3B8; letter-spacing: 1px; margin-bottom: 8px;">
          Financial Breakdown
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="border-bottom: 2px solid #E2E8F0;">
              <th align="left" style="padding: 10px 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Item / Service</th>
              <th align="right" style="padding: 10px 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Rate / VAT</th>
              <th align="right" style="padding: 10px 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Amount (NGN)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #F1F5F9;">
              <td style="padding: 12px 8px; font-size: 13px; color: #0F172A; font-weight: 600;">
                Wallet Credit
                <div style="font-size: 11px; color: #64748B; font-weight: normal; margin-top: 2px;">
                  ${receipt.description || 'Safe Shuttle & School Mobility Access'}
                </div>
              </td>
              <td align="right" style="padding: 12px 8px; font-size: 12px; color: #64748B;">
                Base
              </td>
              <td align="right" style="padding: 12px 8px; font-size: 13px; font-weight: 700; color: #0F172A;">
                ₦${formattedNet}
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 10px 8px; font-size: 12px; color: #475569;">
                Value Added Tax (VAT)
              </td>
              <td align="right" style="padding: 10px 8px; font-size: 12px; color: #64748B;">
                7.5%
              </td>
              <td align="right" style="padding: 10px 8px; font-size: 12px; font-weight: 600; color: #475569;">
                ₦${formattedVat}
              </td>
            </tr>
            <tr style="background-color: #F8FAFC;">
              <td style="padding: 14px 8px; font-size: 14px; font-weight: 800; color: #0A1128;">
                Total Amount Paid
              </td>
              <td align="right" style="padding: 14px 8px; font-size: 11px; color: #059669; font-weight: 700; text-transform: uppercase;">
                Inclusive
              </td>
              <td align="right" style="padding: 14px 8px; font-size: 16px; font-weight: 900; color: #059669;">
                ₦${formattedTotal}
              </td>
            </tr>
            ${
              formattedBalanceAfter
                ? `
            <tr>
              <td colspan="2" style="padding: 8px 8px 4px 8px; font-size: 11px; color: #64748B; text-align: right;">
                Wallet Balance After Credit:
              </td>
              <td align="right" style="padding: 8px 8px 4px 8px; font-size: 12px; font-weight: 700; color: #0F172A;">
                ${formattedBalanceAfter}
              </td>
            </tr>
            `
                : ''
            }
          </tbody>
        </table>

        <!-- CRYPTOGRAPHIC AUTHENTICITY HARDENING BANNER -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 10px; padding: 14px 16px; margin-top: 12px;">
          <tr>
            <td style="vertical-align: top; width: 28px; font-size: 18px; color: #059669; padding-right: 10px;">
              🛡️
            </td>
            <td>
              <div style="font-size: 12px; font-weight: 800; color: #065F46; margin-bottom: 2px;">
                Cryptographic Authenticity Guaranteed
              </div>
              <div style="font-size: 11px; color: #047857; line-height: 1.4; margin-bottom: 6px;">
                This receipt is sealed with an enterprise SHA-256 HMAC verification signature. It guarantees that the monetary amounts and references have not been tampered with.
              </div>
              <div style="font-family: monospace; font-size: 10px; color: #064E3B; background-color: #DCFCE7; padding: 4px 8px; border-radius: 4px; word-break: break-all;">
                HMAC: ${receipt.hmacSignature}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- FOOTER & PRINT NOTIFICATION -->
    <tr>
      <td style="padding: 24px 32px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 11px; color: #64748B; line-height: 1.5;">
          This is an official computer-generated receipt issued by MyEduRide Technologies Ltd. No physical signature is required.
          <br class="no-print">
          <span class="no-print">Tip: Press <strong>Ctrl + P</strong> or <strong>Cmd + P</strong> to print or export this receipt to PDF.</span>
        </p>
        <p style="margin: 0; font-size: 11px; color: #94A3B8;">
          Questions? Contact our 24/7 billing support at <a href="mailto:support@myeduride.com" style="color: #059669; text-decoration: none; font-weight: 600;">support@myeduride.com</a>
        </p>
        <p style="margin: 8px 0 0 0; font-size: 10px; color: #CBD5E1;">
          &copy; ${new Date().getFullYear()} MyEduRide. All rights reserved. Registered under Nigerian Corporate Affairs Commission.
        </p>
      </td>
    </tr>

  </table>
</body>
</html>
  `.trim();
}
