/**
 * STYLED EMAIL RECEIPT TEMPLATE & SERVER DISPATCHER
 * 
 * Re-exports the client-safe HTML renderer and provides server-side email dispatch
 * using the configured email transport (SMTP / Resend).
 */

import { ReceiptData } from '@/lib/payments/receipt-engine';
import { sendEmail } from '@/lib/notifications/email-service';
import { renderPaymentReceiptHtml } from './payment-receipt-render';

export { renderPaymentReceiptHtml };

/**
 * High-level helper to dispatch the styled payment receipt via the active email transport.
 */
export async function sendPaymentReceiptEmail(
  receipt: ReceiptData
): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    const html = renderPaymentReceiptHtml(receipt);
    const subject = `Official Payment Receipt: ₦${receipt.totalAmountNgn.toLocaleString('en-NG', {
      minimumFractionDigits: 2,
    })} (${receipt.receiptNumber})`;

    console.log(
      `[Receipt Email] Dispatching receipt ${receipt.receiptNumber} to ${receipt.userEmail} for ${receipt.transactionReference}...`
    );

    const res = await sendEmail({
      to: receipt.userEmail,
      fromName: 'MyEduRide Finance',
      subject,
      html,
    });

    console.log(`[Receipt Email] Successfully dispatched receipt ${receipt.receiptNumber}`);
    return { success: true, data: res };
  } catch (err: any) {
    console.error(
      `[Receipt Email] Failed to send receipt email to ${receipt.userEmail}:`,
      err
    );
    return { success: false, error: err.message || err };
  }
}
