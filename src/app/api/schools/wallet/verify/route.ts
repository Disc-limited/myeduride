import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAdminClient } from '@/lib/supabase/admin';
import { SeerBitClient } from '@/lib/payments/seerbit';
import { generateReceipt } from '@/lib/payments/receipt-engine';
import { sendPaymentReceiptEmail } from '@/lib/notifications/email-templates/payment-receipt';

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
      .select('*, wallet:wallets(id, school_id, available_balance_kobo)')
      .eq('reference', reference)
      .maybeSingle();

    if (intentErr || !intent) {
      return NextResponse.json({ error: 'Payment intent not found' }, { status: 404 });
    }

    // 2. Zero-IDOR check: verify caller is admin for this school
    const schoolId = intent.metadata?.school_id || (intent.wallet as any)?.school_id;
    if (schoolId) {
      const { data: userRoles } = await supabase
        .from('user_school_roles')
        .select('role')
        .eq('user_id', session.user_id)
        .eq('is_active', true)
        .or(`school_id.eq.${schoolId},role.eq.super_admin`);

      const hasPrivilege = (userRoles || []).some(
        (r) => r.role === 'school_admin' || r.role === 'super_admin'
      );

      if (!hasPrivilege) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to verify payments for this school' },
          { status: 403 }
        );
      }
    }

    // 3. Idempotent check: if already processed
    if (intent.status === 'SUCCESS') {
      const { data: currentWallet } = await supabase
        .from('wallets')
        .select('available_balance_kobo')
        .eq('id', intent.wallet_id)
        .single();

      return NextResponse.json({
        success: true,
        status: 'SUCCESS',
        message: 'School wallet deposit already verified and credited',
        amount_kobo: intent.amount_kobo || 0,
        available_balance_kobo: currentWallet?.available_balance_kobo || 0,
        available_balance_ngn: (currentWallet?.available_balance_kobo || 0) / 100,
        receipt: intent.metadata?.receipt || null,
      });
    }

    // 4. Query SeerBit server directly to verify payment
    const verifyRes = await SeerBitClient.verifyPayment(reference);
    const payments = verifyRes.data?.payments;
    const isSuccessful =
      verifyRes.status === 'SUCCESS' &&
      payments &&
      (payments.status === 'SUCCESS' ||
        payments.gatewayCode === '00' ||
        verifyRes.data?.code === '00');

    if (isSuccessful) {
      const amountKobo = intent.amount_kobo || Math.round(Number(payments?.amount || 0) * 100);

      // Resolve institutional details
      let schoolName = intent.metadata?.school_name;
      let adminEmail = intent.metadata?.admin_email || session.email;
      let phone = session.phone;

      if (!schoolName && schoolId) {
        const { data: schoolData } = await supabase
          .from('schools')
          .select('name, email, phone')
          .eq('id', schoolId)
          .maybeSingle();

        if (schoolData) {
          schoolName = schoolData.name;
          adminEmail = adminEmail || schoolData.email;
          phone = phone || schoolData.phone;
        }
      }

      schoolName = schoolName || 'Educational Institution';
      adminEmail = adminEmail || 'billing@myeduride.com';
      const gatewayRef = payments?.paymentReference || (payments as any)?.gatewayReference || reference;
      const paymentChannel = payments?.paymentType || payments?.channelType || 'SEERBIT_CHECKOUT';

      // Generate Standardized Institutional Receipt
      const receiptData = generateReceipt({
        transactionReference: reference,
        gatewayReference: gatewayRef,
        entityType: 'SCHOOL',
        entityName: schoolName,
        userEmail: adminEmail,
        userPhone: phone || undefined,
        amountKobo,
        paymentChannel,
        timestamp: new Date(),
        description: 'Institutional Wallet Deposit (Safe Passage & Gate Security)',
      });

      // 5. Execute atomic database ledger credit
      const { data: creditResult, error: creditErr } = await supabase.rpc(
        'execute_atomic_wallet_credit',
        {
          p_wallet_id: intent.wallet_id,
          p_amount_kobo: amountKobo,
          p_channel: 'SEERBIT_CHECKOUT',
          p_reference: reference,
          p_description: `Institutional wallet deposit verified (${payments?.paymentType || 'Online Checkout'})`,
          p_metadata: {
            seerbit_reference: gatewayRef,
            verified_via: 'SCHOOL_CLIENT_REDIRECT_VERIFY',
            school_id: schoolId,
            receipt: receiptData,
          },
          p_payment_intent_id: intent.id,
        }
      );

      if (creditErr) {
        console.error('[SchoolWalletVerify API] execute_atomic_wallet_credit error:', creditErr);
        throw creditErr;
      }

      // Attach final balance to receipt
      if (creditResult?.balance_after_kobo) {
        receiptData.balanceAfterNgn = creditResult.balance_after_kobo / 100;
      }

      // 6. Update intent record
      await supabase
        .from('payment_intents')
        .update({
          status: 'SUCCESS',
          seerbit_reference: gatewayRef,
          metadata: {
            ...(intent.metadata || {}),
            receipt: receiptData,
            receipt_sent: true,
            receipt_sent_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', intent.id);

      // Instant Institutional Email Receipt Dispatch
      sendPaymentReceiptEmail(receiptData).catch((emailErr) => {
        console.error('[SchoolWalletVerify API] sendPaymentReceiptEmail failed:', emailErr);
      });

      // 7. Dispatch in-app notification
      const amountNgn = (amountKobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 });
      await supabase.from('notifications').insert({
        user_id: session.user_id,
        title: 'Institutional Wallet Credited 🏫💳',
        message: `School wallet has been successfully credited with ₦${amountNgn}. Daily gate fees and platform security are active.`,
        type: 'wallet_credit',
        is_read: false,
      });

      return NextResponse.json({
        success: true,
        status: 'SUCCESS',
        credited: true,
        available_balance_kobo: creditResult?.balance_after_kobo,
        available_balance_ngn: (creditResult?.balance_after_kobo || 0) / 100,
        receipt: receiptData,
      });
    }

    return NextResponse.json({
      success: false,
      status: intent.status || 'PENDING',
      message: verifyRes.message || 'Payment confirmation pending gateway finalization',
    });
  } catch (err: any) {
    console.error('[SchoolWalletVerify API] exception:', err);
    return NextResponse.json({ error: err.message || 'Verification exception' }, { status: 500 });
  }
}
