import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { SeerBitClient } from '@/lib/payments/seerbit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const reference = body.reference?.trim();

    if (!reference) {
      return NextResponse.json({ error: 'Missing transaction reference' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // 1. Locate payment intent
    const { data: intent, error: intentErr } = await supabase
      .from('payment_intents')
      .select('*, wallet:wallets(id, user_id, available_balance_kobo)')
      .eq('reference', reference)
      .eq('user_id', session.user_id)
      .maybeSingle();

    if (intentErr || !intent) {
      return NextResponse.json({ error: 'Payment intent not found for this account' }, { status: 404 });
    }

    // 2. If already processed by webhook
    if (intent.status === 'SUCCESS') {
      const { data: currentWallet } = await supabase
        .from('wallets')
        .select('available_balance_kobo')
        .eq('id', intent.wallet_id)
        .single();

      return NextResponse.json({
        success: true,
        status: 'SUCCESS',
        message: 'Wallet already funded',
        amount_kobo: intent.amount_kobo || 0,
        available_balance_kobo: currentWallet?.available_balance_kobo || 0,
        available_balance_ngn: (currentWallet?.available_balance_kobo || 0) / 100,
      });
    }

    // 3. Query SeerBit Server directly to verify payment authenticity
    const verifyRes = await SeerBitClient.verifyPayment(reference);
    const payments = verifyRes.data?.payments;
    const isSuccessful =
      verifyRes.status === 'SUCCESS' &&
      payments &&
      (payments.status === 'SUCCESS' || payments.gatewayCode === '00' || verifyRes.data?.code === '00');

    if (isSuccessful) {
      const amountKobo = intent.amount_kobo || Math.round(Number(payments?.amount || 0) * 100);

      // Execute atomic credit
      const { data: creditResult, error: creditErr } = await supabase.rpc(
        'execute_atomic_wallet_credit',
        {
          p_wallet_id: intent.wallet_id,
          p_amount_kobo: amountKobo,
          p_channel: 'SEERBIT_CHECKOUT',
          p_reference: reference,
          p_description: `Wallet deposit verified (${payments?.paymentType || 'Online Checkout'})`,
          p_metadata: {
            seerbit_reference: payments?.paymentReference || reference,
            verified_via: 'CLIENT_REDIRECT_VERIFY',
          },
          p_payment_intent_id: intent.id,
        }
      );

      if (creditErr) {
        console.error('[Wallet Verify API] execute_atomic_wallet_credit error:', creditErr);
        throw creditErr;
      }

      await supabase
        .from('payment_intents')
        .update({
          status: 'SUCCESS',
          seerbit_reference: payments?.paymentReference || reference,
          updated_at: new Date().toISOString(),
        })
        .eq('id', intent.id);

      const amountNgn = (amountKobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 });
      await supabase.from('notifications').insert({
        user_id: session.user_id,
        title: 'Wallet Funded Successfully! 💳',
        message: `Your MyEduRide wallet has been credited with ₦${amountNgn}. Your school shuttle rides are active and funded.`,
        type: 'wallet_credit',
        is_read: false,
      });

      return NextResponse.json({
        success: true,
        status: 'SUCCESS',
        credited: true,
        available_balance_kobo: creditResult?.balance_after_kobo,
        available_balance_ngn: (creditResult?.balance_after_kobo || 0) / 100,
      });
    }

    return NextResponse.json({
      success: false,
      status: intent.status || 'PENDING',
      message: verifyRes.message || 'Payment verification pending gateway confirmation',
    });
  } catch (err: any) {
    console.error('[Wallet Verify API] exception:', err);
    return NextResponse.json({ error: err.message || 'Verification exception' }, { status: 500 });
  }
}
