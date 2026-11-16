import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { verifySeerbitWebhookSignature, isTimestampSkewValid, computePayloadHash, isSeerbitIpAllowed } from '@/lib/security/webhook-security';
import { generateReceipt } from '@/lib/payments/receipt-engine';
import { sendPaymentReceiptEmail } from '@/lib/notifications/email-templates/payment-receipt';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature =
      request.headers.get('x-seerbit-signature') ||
      request.headers.get('seerbit-signature') ||
      request.headers.get('x-sha512-signature') ||
      request.headers.get('x-signature');

    const candidateSecrets = [
      process.env.SEERBIT_WEBHOOK_SECRET,
      process.env.SEERBIT_SECRET_KEY,
      process.env.SEERBIT_PUBLIC_KEY,
    ].filter(Boolean) as string[];

    const isDev = process.env.NODE_ENV !== 'production';
    const testBypass = isDev && request.headers.get('x-seerbit-test-bypass') === 'true';

    // 1. Timing-Safe HMAC Verification (Layer 6 Ingestion Security)
    if (!testBypass && candidateSecrets.length > 0 && signature) {
      const isValidSig = verifySeerbitWebhookSignature(rawBody, signature, candidateSecrets);
      if (!isValidSig) {
        console.warn('[SeerBit Webhook] Rejected unauthorized webhook: signature mismatch');
        return NextResponse.json({ error: 'Invalid cryptographic signature' }, { status: 401 });
      }
    }

    // 2. Anti-Replay Timestamp Skew Check (if x-seerbit-timestamp explicitly supplied)
    const timestampHeader = request.headers.get('x-seerbit-timestamp');
    if (timestampHeader && !isTimestampSkewValid(timestampHeader, 5)) {
      console.warn('[SeerBit Webhook] Rejected suspect replay attack: timestamp skew > 5 minutes');
      return NextResponse.json({ error: 'Timestamp skew threshold exceeded' }, { status: 400 });
    }

    // 3. Egress IP Allowlist Validation (only if explicitly enabled via environment variable)
    if (process.env.SEERBIT_ENFORCE_IP_ALLOWLIST === 'true') {
      const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip');
      if (!isSeerbitIpAllowed(clientIp)) {
        console.warn(`[SeerBit Webhook] Rejected unauthorized egress IP: ${clientIp}`);
        return NextResponse.json({ error: 'Origin IP not allowed' }, { status: 403 });
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    // SeerBit payloads may be nested inside notificationItems[0].notificationRequestItem or data.payments
    const notificationItem = payload.notificationItems?.[0]?.notificationRequestItem;
    const itemData = notificationItem?.data || payload.data || payload;
    const payments = itemData?.payments || itemData;

    const paymentRef =
      payments.reference ||
      payments.paymentReference ||
      payments.transactionRef ||
      payload.reference ||
      itemData?.reference;

    const eventId =
      notificationItem?.eventId ||
      payload.eventId ||
      payments.gatewayReference ||
      payments.transactionId ||
      paymentRef ||
      computePayloadHash(rawBody);

    const paymentStatus = (
      payments.gatewayCode ||
      payments.code ||
      payments.status ||
      payload.status ||
      ''
    ).toUpperCase();

    const gatewayMessage = (
      payments.gatewayMessage ||
      payments.reason ||
      payload.message ||
      ''
    ).toUpperCase();

    const rawAmount = Number(payments.amount || payments.debitedAmount || payload.amount || 0);

    if (!paymentRef && !payments.virtualAccount?.accountNumber && !payments.accountNumber) {
      return NextResponse.json({ error: 'Missing payment reference and account number' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // 4. Idempotency Check (Pillar 7: Idempotent Consumers)
    const { data: existingEvent } = await supabase
      .from('processed_webhooks')
      .select('id, status')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      console.log(`[SeerBit Webhook] Idempotent duplicate event ${eventId} ignored`);
      return NextResponse.json({ message: 'Event already processed' }, { status: 200 });
    }

    // 5. Dual Target Resolution: Direct Virtual Account Transfer OR Payment Intent (Card/USSD)
    const virtualAccountNum = String(
      payments.virtualAccount?.accountNumber ||
      payments.accountNumber ||
      payments.virtualAccountNumber ||
      itemData?.virtualAccount?.accountNumber ||
      itemData?.accountNumber ||
      itemData?.virtual_account_number ||
      ''
    ).trim();

    const linkingRef = String(
      payments.linkingreference ||
      payments.linkingReference ||
      payments.paymentReference ||
      paymentRef ||
      ''
    ).trim();

    let wallet: any = null;
    let intent: any = null;
    let isVirtualAccountTransfer = false;

    // A. Check if this is a dedicated Virtual Account bank transfer by NUBAN Account Number
    if (virtualAccountNum) {
      const { data: vWallet } = await supabase
        .from('wallets')
        .select('*, user_profile:user_profiles!wallets_user_id_fkey(full_name, email, phone)')
        .eq('virtual_account_number', virtualAccountNum)
        .maybeSingle();

      if (vWallet) {
        wallet = vWallet;
        isVirtualAccountTransfer = true;
      }
    }

    // B. If not found by NUBAN, check by Virtual Account Reference / linking reference on wallets
    if (!wallet && linkingRef) {
      const { data: vWallet } = await supabase
        .from('wallets')
        .select('*, user_profile:user_profiles!wallets_user_id_fkey(full_name, email, phone)')
        .eq('virtual_account_reference', linkingRef)
        .maybeSingle();

      if (vWallet) {
        wallet = vWallet;
        isVirtualAccountTransfer = true;
      }
    }

    // C. If not a virtual account transfer, locate Payment Intent (for Card / USSD checkout)
    if (!wallet && paymentRef) {
      const { data: foundIntent } = await supabase
        .from('payment_intents')
        .select('*, wallet:wallets(id, user_id, available_balance_kobo)')
        .eq('reference', paymentRef)
        .maybeSingle();

      if (foundIntent) {
        intent = foundIntent;
        wallet = foundIntent.wallet;
      }
    }

    if (!wallet) {
      console.warn(`[SeerBit Webhook] No matching wallet or intent found for ref: ${paymentRef}, account: ${virtualAccountNum}`);
      await supabase.from('processed_webhooks').insert({
        event_id: eventId,
        provider: 'seerbit',
        event_type: payload.notificationType || payload.event || 'UNKNOWN',
        payload_hash: computePayloadHash(rawBody),
        status: 'IGNORED',
      });
      return NextResponse.json({ message: 'No matching wallet or intent found' }, { status: 200 });
    }

    // If intent was already processed
    if (intent && intent.status === 'SUCCESS') {
      return NextResponse.json({ message: 'Payment intent already marked success' }, { status: 200 });
    }

    const isSuccessful =
      paymentStatus === 'SUCCESS' ||
      paymentStatus === 'SUCCESSFUL' ||
      paymentStatus === '00' ||
      gatewayMessage === 'SUCCESSFUL' ||
      payments.gatewayCode === '00';

    if (isSuccessful) {
      const amountKobo = intent?.amount_kobo || Math.round(rawAmount * 100);

      if (amountKobo <= 0) {
        return NextResponse.json({ error: 'Invalid transaction amount' }, { status: 400 });
      }

      // Resolve entity identity and customer details
      const entityType =
        wallet.entity_type === 'school'
          ? 'SCHOOL'
          : wallet.entity_type === 'escort'
          ? 'ESCORT'
          : 'PARENT';

      let entityName =
        wallet.user_profile?.full_name ||
        intent?.metadata?.parent_name ||
        intent?.metadata?.school_name ||
        payments.customer?.name ||
        payments.customer?.fullName ||
        (entityType === 'SCHOOL' ? 'School Administration' : 'Parent');

      let userEmail =
        wallet.user_profile?.email ||
        intent?.metadata?.parent_email ||
        intent?.metadata?.admin_email ||
        payments.customer?.email ||
        'billing@myeduride.com';

      let userPhone =
        wallet.user_profile?.phone ||
        intent?.metadata?.parent_phone ||
        payments.customer?.phone ||
        payments.customer?.mobile ||
        null;

      // Fallback: look up user_profiles if needed
      if ((!entityName || !userEmail) && wallet.user_id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('full_name, email, phone')
          .eq('id', wallet.user_id)
          .maybeSingle();

        if (profile) {
          entityName = profile.full_name || entityName;
          userEmail = profile.email || userEmail;
          userPhone = profile.phone || userPhone;
        }
      }

      const gatewayRef = payments.gatewayReference || payments.transactionRef || paymentRef;
      const bankName =
        payments.virtualAccount?.bankName ||
        wallet.virtual_bank_name ||
        'Virtual Bank Account';

      const paymentChannel = isVirtualAccountTransfer
        ? 'BANK_TRANSFER'
        : payments.paymentType || payments.channelType || 'SEERBIT_CHECKOUT';

      const description = isVirtualAccountTransfer
        ? `Wallet deposit via Bank Transfer (${bankName} - ${virtualAccountNum || wallet.virtual_account_number})`
        : `Wallet deposit via SeerBit (${payments.paymentType || 'Online Checkout'})`;

      // Generate Standardized Cryptographic Receipt
      const receiptData = generateReceipt({
        transactionReference: paymentRef || gatewayRef,
        gatewayReference: gatewayRef,
        entityType,
        entityName,
        userEmail,
        userPhone: userPhone || undefined,
        amountKobo,
        paymentChannel: isVirtualAccountTransfer ? 'Virtual Account Bank Transfer' : paymentChannel,
        timestamp: new Date(),
        description,
      });

      // 6. Execute Atomic Wallet Credit via Stored Procedure
      const { data: creditResult, error: creditErr } = await supabase.rpc(
        'execute_atomic_wallet_credit',
        {
          p_wallet_id: wallet.id,
          p_amount_kobo: amountKobo,
          p_channel: paymentChannel,
          p_reference: paymentRef || gatewayRef,
          p_description: description,
          p_metadata: {
            seerbit_reference: gatewayRef,
            channel_type: isVirtualAccountTransfer ? 'BANK_TRANSFER' : (payments.channelType || 'CARD'),
            bank_name: bankName,
            account_number: virtualAccountNum || wallet.virtual_account_number,
            customer: payments.customer || {},
            verified_via: 'WEBHOOK',
            receipt: receiptData,
          },
          p_payment_intent_id: intent?.id || null,
        }
      );

      if (creditErr) {
        console.error('[SeerBit Webhook] execute_atomic_wallet_credit error:', creditErr);
        throw creditErr;
      }

      // Attach final balance to receipt
      if (creditResult?.balance_after_kobo) {
        receiptData.balanceAfterNgn = creditResult.balance_after_kobo / 100;
      }

      // Sync user_profiles wallet_balance if user_id present
      if (wallet.user_id && creditResult?.balance_after_kobo) {
        await supabase
          .from('user_profiles')
          .update({ wallet_balance: Number(creditResult.balance_after_kobo) / 100 })
          .eq('id', wallet.user_id);
      }

      // Update intent status if intent exists
      if (intent?.id) {
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
      }

      // Record successful webhook execution
      await supabase.from('processed_webhooks').insert({
        event_id: eventId,
        provider: 'seerbit',
        event_type: payload.notificationType || 'TRANSACTION_SUCCESSFUL',
        payload_hash: computePayloadHash(rawBody),
        status: 'SUCCESS',
      });

      // Instant Email Receipt Dispatch
      sendPaymentReceiptEmail(receiptData).catch((emailErr) => {
        console.error('[SeerBit Webhook] sendPaymentReceiptEmail failed:', emailErr);
      });

      // Dispatch in-app notification
      const amountNgn = (amountKobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 });
      if (wallet.user_id) {
        await supabase.from('notifications').insert({
          user_id: wallet.user_id,
          title: 'Wallet Funded Successfully! 💳',
          message: `Your MyEduRide wallet has been credited with ₦${amountNgn} via direct bank transfer. Your account is active.`,
          type: 'wallet_credit',
          is_read: false,
        });
      }

      console.log(`[SeerBit Webhook] Successfully credited wallet ${wallet.id} with ₦${amountNgn} (ref: ${paymentRef || gatewayRef})`);
      return NextResponse.json({ status: 'success', credit: creditResult, receipt: receiptData }, { status: 200 });
    } else {
      // Payment failed
      if (intent?.id) {
        await supabase
          .from('payment_intents')
          .update({
            status: 'FAILED',
            seerbit_reference: payments.gatewayReference || paymentRef,
            updated_at: new Date().toISOString(),
          })
          .eq('id', intent.id);
      }

      await supabase.from('processed_webhooks').insert({
        event_id: eventId,
        provider: 'seerbit',
        event_type: payload.notificationType || 'TRANSACTION_FAILED',
        payload_hash: computePayloadHash(rawBody),
        status: 'FAILED',
      });

      return NextResponse.json({ status: 'failed_acknowledged' }, { status: 200 });
    }
  } catch (err: any) {
    console.error('[SeerBit Webhook] Handler exception:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
