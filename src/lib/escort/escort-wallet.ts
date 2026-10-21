import { getAdminClient } from '@/lib/supabase/admin';
import { sendPushToUser } from '@/lib/push/send';
import { sendEmail } from '@/lib/notifications/email-service';
import { getEscortApplications } from '@/lib/escort/escort-db';

export interface EscortWalletInfo {
  walletId: string;
  userId: string;
  escortId: string;
  fullName: string;
  email?: string;
  phone?: string;
  availableBalanceKobo: number;
  availableBalanceNgn: number;
}

export function formatKoboToNgn(kobo: number): string {
  const ngn = (kobo || 0) / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(ngn)
    .replace('NGN', '₦')
    .trim();
}

/**
 * Resolves an escort's active wallet or provisions one atomically if absent.
 * Accepts either escort application ID (e.g. APP-ESC-126) or user_id UUID.
 */
export async function getOrCreateEscortWallet(escortIdOrUserId: string): Promise<EscortWalletInfo | null> {
  if (!escortIdOrUserId || !escortIdOrUserId.trim()) return null;

  const supabase = getAdminClient();
  const cleanId = escortIdOrUserId.trim();

  // 1. Resolve escort application record
  const allApps = await getEscortApplications().catch(() => []);
  const escortApp = allApps.find(
    (a) =>
      a.id === cleanId ||
      a.user_id === cleanId ||
      a.escortIdCode === cleanId ||
      a.escort_code === cleanId
  );

  const targetUserId = escortApp?.user_id || cleanId;
  const escortName = escortApp?.fullName || escortApp?.name || 'Escort';
  const escortEmail = escortApp?.email || escortApp?.emailOrUsername || '';
  const escortPhone = escortApp?.phone || '';

  // 2. Query wallet table for this escort
  let { data: wallet } = await supabase
    .from('wallets')
    .select('id, user_id, available_balance_kobo, status')
    .eq('user_id', targetUserId)
    .eq('entity_type', 'escort')
    .maybeSingle();

  if (!wallet) {
    // Check if any wallet exists for user_id
    const { data: anyW } = await supabase
      .from('wallets')
      .select('id, user_id, available_balance_kobo, status')
      .eq('user_id', targetUserId)
      .maybeSingle();
    wallet = anyW;
  }

  // 3. Auto-provision wallet if none exists
  if (!wallet) {
    const { data: newW, error: createErr } = await supabase
      .from('wallets')
      .insert({
        user_id: targetUserId,
        entity_type: 'escort',
        currency: 'NGN',
        available_balance_kobo: 0,
        status: 'active',
      })
      .select('id, user_id, available_balance_kobo, status')
      .single();

    if (createErr) {
      console.error('[EscortWallet] Failed to provision escort wallet:', createErr);
      return null;
    }
    wallet = newW;
  }

  return {
    walletId: wallet.id,
    userId: targetUserId,
    escortId: escortApp?.id || cleanId,
    fullName: escortName,
    email: escortEmail,
    phone: escortPhone,
    availableBalanceKobo: Number(wallet.available_balance_kobo || 0),
    availableBalanceNgn: Number(wallet.available_balance_kobo || 0) / 100,
  };
}

/**
 * Dispatches high-priority payout notification to the escort:
 * In-app alert + web push + email notification.
 * Exact wording:
 * "💰 Daily Payout Dropped: ₦[Amount] has been credited to your available balance for today's completed rides."
 */
export async function notifyEscortDailyPayoutDrop(params: {
  escortUserId: string;
  escortName: string;
  escortEmail?: string;
  amountKobo: number;
  completedTripsCount: number;
  dateStr?: string;
}) {
  const supabase = getAdminClient();
  const formattedAmount = formatKoboToNgn(params.amountKobo);
  const title = '💰 Daily Payout Dropped';
  const message = `💰 Daily Payout Dropped: ${formattedAmount} has been credited to your available balance for today's completed rides.`;

  // 1. In-App Notification
  try {
    await supabase.from('notifications').insert({
      user_id: params.escortUserId,
      title,
      message,
      type: 'financial_alert',
      metadata: {
        amount_kobo: params.amountKobo,
        formatted_amount: formattedAmount,
        completed_trips_count: params.completedTripsCount,
        settlement_date: params.dateStr || new Date().toISOString().slice(0, 10),
        payout_type: 'DAILY_EVENING_SETTLEMENT',
      },
    });
  } catch (err) {
    console.warn('[EscortWallet] Failed to insert payout in-app notification:', err);
  }

  // 2. Web Push Notification
  try {
    await sendPushToUser(supabase, params.escortUserId, {
      title,
      message,
      type: 'system',
      url: '/dashboard/escort',
    });
  } catch (pushErr) {
    console.warn('[EscortWallet] Push notification dispatch notice:', pushErr);
  }

  // 3. Email Notification (if email available)
  if (params.escortEmail && params.escortEmail.includes('@')) {
    try {
      await sendEmail({
        fromName: 'MyEduRide Finance',
        to: params.escortEmail,
        subject: `Daily Payout Dropped: ${formattedAmount} Credited to Your Wallet`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; background: #0b1c30; color: #ffffff; padding: 28px; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 32px;">💰</span>
              <h2 style="color: #00A859; margin: 8px 0 0 0; font-size: 22px;">Daily Payout Released!</h2>
              <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0;">7:00 PM Automated Escrow Settlement</p>
            </div>
            <div style="background: #132842; border: 1px solid #1e3a5f; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Total Payout Amount</p>
              <h1 style="margin: 6px 0 0 0; color: #ffffff; font-size: 32px; font-weight: 800;">${formattedAmount}</h1>
              <div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid #1e3a5f; font-size: 13px; color: #cbd5e1;">
                <p style="margin: 4px 0;"><strong>Recipient:</strong> ${params.escortName}</p>
                <p style="margin: 4px 0;"><strong>Completed Rides:</strong> ${params.completedTripsCount} student leg(s)</p>
                <p style="margin: 4px 0;"><strong>Destination:</strong> Available Balance (Withdrawable)</p>
              </div>
            </div>
            <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0;">
              This payout was verified and automatically released from the transport escrow vault upon confirmation of all student drop-offs.
            </p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.warn('[EscortWallet] Email receipt dispatch notice:', emailErr);
    }
  }
}
