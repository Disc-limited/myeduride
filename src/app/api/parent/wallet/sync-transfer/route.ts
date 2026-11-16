import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { SeerBitClient } from '@/lib/payments/seerbit';
import { generateReceipt } from '@/lib/payments/receipt-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session || !sessionHasRole(session, 'parent')) {
    return NextResponse.json({ error: 'Parent authentication required' }, { status: 401 });
  }

  try {
    const supabase = getAdminClient();
    const body = await request.json().catch(() => ({}));
    const customRef = body.reference?.trim();

    // 1. Get parent wallet
    const { data: wallet, error: walletErr } = await supabase
      .from('wallets')
      .select('*, user_profile:user_profiles!wallets_user_id_fkey(full_name, email, phone)')
      .eq('user_id', session.user_id)
      .eq('entity_type', 'parent')
      .maybeSingle();

    if (walletErr || !wallet) {
      return NextResponse.json({ error: 'Parent wallet not found' }, { status: 404 });
    }

    if (!wallet.virtual_account_number && !wallet.virtual_account_reference) {
      return NextResponse.json(
        { error: 'No virtual bank account assigned to this wallet yet.' },
        { status: 400 }
      );
    }

    // 2. If a specific transaction reference was provided, verify it directly with SeerBit
    if (customRef) {
      const verifyRes = await SeerBitClient.verifyPayment(customRef);
      const payments = (verifyRes?.data?.payments || verifyRes?.data) as any;
      const isSuccess =
        verifyRes?.status === 'SUCCESS' &&
        (payments?.status === 'SUCCESS' || payments?.gatewayCode === '00' || payments?.code === '00');

      if (isSuccess && payments) {
        const amountNgn = Number(payments.amount || 0);
        const amountKobo = Math.round(amountNgn * 100);

        // Check if already credited
        const { data: existingTx } = await supabase
          .from('wallet_transactions')
          .select('id')
          .eq('reference', customRef)
          .maybeSingle();

        if (existingTx) {
          return NextResponse.json({
            success: true,
            already_credited: true,
            message: 'This transaction was already credited to your wallet.',
            balance_ngn: Number(wallet.available_balance_kobo) / 100,
          });
        }

        const receipt = generateReceipt({
          transactionReference: customRef,
          gatewayReference: payments.gatewayReference || customRef,
          entityType: 'PARENT',
          entityName: session.full_name || wallet.user_profile?.full_name || 'Valued Parent',
          userEmail: session.email || wallet.user_profile?.email || 'parent@myeduride.com',
          userPhone: session.phone || wallet.user_profile?.phone || undefined,
          amountKobo,
          paymentChannel: 'Virtual Account Bank Transfer',
          timestamp: new Date(),
          description: `Direct Bank Transfer (${wallet.virtual_bank_name || 'Virtual Account'} - ${wallet.virtual_account_number})`,
        });

        const { data: creditResult, error: creditErr } = await supabase.rpc(
          'execute_atomic_wallet_credit',
          {
            p_wallet_id: wallet.id,
            p_amount_kobo: amountKobo,
            p_channel: 'BANK_TRANSFER',
            p_reference: customRef,
            p_description: `Direct Bank Transfer (${wallet.virtual_bank_name || 'Virtual Account'} - ${wallet.virtual_account_number})`,
            p_metadata: {
              seerbit_reference: payments.gatewayReference || customRef,
              channel_type: 'BANK_TRANSFER',
              bank_name: wallet.virtual_bank_name,
              account_number: wallet.virtual_account_number,
              verified_via: 'MANUAL_PARENT_SYNC',
              receipt,
            },
          }
        );

        if (creditErr) {
          throw creditErr;
        }

        const newBalNgn = Number(creditResult.balance_after_kobo) / 100;
        await supabase
          .from('user_profiles')
          .update({ wallet_balance: newBalNgn })
          .eq('id', session.user_id);

        return NextResponse.json({
          success: true,
          credited: true,
          amount_ngn: amountNgn,
          new_balance_ngn: newBalNgn,
          message: `Successfully verified and credited ₦${amountNgn.toLocaleString()}!`,
        });
      }
    }

    // 3. Automated Check: Check recent pending payment intents for this parent (last 4 hours)
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { data: pendingIntents } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('user_id', session.user_id)
      .eq('status', 'PENDING')
      .gte('created_at', fourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(3);

    if (pendingIntents && pendingIntents.length > 0) {
      for (const pIntent of pendingIntents) {
        try {
          const verifyRes = await SeerBitClient.verifyPayment(pIntent.reference);
          const payments = (verifyRes?.data?.payments || verifyRes?.data) as any;
          const isSuccess =
            verifyRes?.status === 'SUCCESS' &&
            (payments?.status === 'SUCCESS' || payments?.gatewayCode === '00' || payments?.code === '00');

          if (isSuccess && payments) {
            const amountNgn = Number(payments.amount || pIntent.amount_kobo / 100 || 0);
            const amountKobo = Math.round(amountNgn * 100);

            const { data: existingTx } = await supabase
              .from('wallet_transactions')
              .select('id')
              .eq('reference', pIntent.reference)
              .maybeSingle();

            if (!existingTx) {
              const receipt = generateReceipt({
                transactionReference: pIntent.reference,
                gatewayReference: payments.gatewayReference || pIntent.reference,
                entityType: 'PARENT',
                entityName: session.full_name || wallet.user_profile?.full_name || 'Valued Parent',
                userEmail: session.email || wallet.user_profile?.email || 'parent@myeduride.com',
                amountKobo,
                paymentChannel: payments.paymentType || 'SEERBIT_CHECKOUT',
                timestamp: new Date(),
                description: `Wallet deposit verified (${payments.paymentType || 'Online Checkout'})`,
              });

              const { data: creditResult } = await supabase.rpc('execute_atomic_wallet_credit', {
                p_wallet_id: wallet.id,
                p_amount_kobo: amountKobo,
                p_channel: payments.paymentType || 'SEERBIT_CHECKOUT',
                p_reference: pIntent.reference,
                p_description: `Wallet deposit verified (${payments.paymentType || 'Online Checkout'})`,
                p_metadata: {
                  seerbit_reference: payments.gatewayReference || pIntent.reference,
                  verified_via: 'AUTO_INTENT_SYNC',
                  receipt,
                },
                p_payment_intent_id: pIntent.id,
              });

              await supabase
                .from('payment_intents')
                .update({ status: 'SUCCESS', updated_at: new Date().toISOString() })
                .eq('id', pIntent.id);

              if (creditResult?.balance_after_kobo) {
                const newBalNgn = Number(creditResult.balance_after_kobo) / 100;
                await supabase
                  .from('user_profiles')
                  .update({ wallet_balance: newBalNgn })
                  .eq('id', session.user_id);

                return NextResponse.json({
                  success: true,
                  credited: true,
                  amount_ngn: amountNgn,
                  new_balance_ngn: newBalNgn,
                  message: `Verified and credited deposit of ₦${amountNgn.toLocaleString()}!`,
                });
              }
            }
          }
        } catch (intentErr) {
          console.warn('[sync-transfer] Pending intent check warning:', intentErr);
        }
      }
    }

    // 4. Return current fresh balance
    const { data: freshWallet } = await supabase
      .from('wallets')
      .select('available_balance_kobo, virtual_account_number, virtual_bank_name')
      .eq('id', wallet.id)
      .single();

    return NextResponse.json({
      success: true,
      synced: true,
      balance_ngn: Number(freshWallet?.available_balance_kobo || wallet.available_balance_kobo) / 100,
      account_number: freshWallet?.virtual_account_number || wallet.virtual_account_number,
      bank_name: freshWallet?.virtual_bank_name || wallet.virtual_bank_name,
      message: 'Wallet status is up to date.',
    });
  } catch (err: any) {
    console.error('[sync-transfer error]:', err);
    return NextResponse.json({ error: err.message || 'Error syncing transfer' }, { status: 500 });
  }
}
