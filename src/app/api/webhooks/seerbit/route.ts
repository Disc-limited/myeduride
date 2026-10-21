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
      process.env.SEERBIT_PUBLIC_KEY,
      process.env.SEERBIT_SECRET_KEY,
    ].filter(Boolean) as string[];

    const isDev = process.env.NODE_ENV !== 'production';
    const testBypass = isDev && request.headers.get('x-seerbit-test-bypass') === 'true';

    // 1. Timing-Safe HMAC Verification (Layer 6 Ingestion Security)
    if (!testBypass && candidateSecrets.length > 0) {
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

    // 3. Egress IP Allowlist Validation
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip');
    if (process.env.NODE_ENV === 'production' && !isSeerbitIpAllowed(clientIp)) {
      console.warn(`[SeerBit Webhook] Rejected unauthorized egress IP: ${clientIp}`);
      return NextResponse.json({ error: 'Origin IP not allowed' }, { status: 403 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    // SeerBit payloads may be nested inside notificationItems[0].notificationRequestItem
    const notificationItem = payload.notificationItems?.[0]?.notificationRequestItem;
    const itemData = notificationItem?.data || payload.data || payload;
    const payments = itemData?.payments || itemData;

    const paymentRef =
      payments.reference ||
      payments.paymentReference ||
      payload.reference ||
      itemData?.reference;

    const eventId =
      notificationItem?.eventId ||
      payload.eventId ||
      payments.gatewayReference ||
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

    const rawAmount = Number(payments.amount || payload.amount || 0);

    if (!paymentRef) {
      return NextResponse.json({ error: 'Missing payment reference' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // 3. Idempotency Check (Pillar 7: Idempotent Consumers)
    const { data: existingEvent } = await supabase
      .from('processed_webhooks')
      .select('id, status')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      console.log(`[SeerBit Webhook] Idempotent duplicate event ${eventId} ignored`);
      return NextResponse.json({ message: 'Event already processed' }, { status: 200 });
    }

    // 4. Locate payment intent
    const { data: intent, error: intentErr } = await supabase
      .from('payment_intents')
      .select('*, wallet:wallets(id, user_id, available_balance_kobo)')
      .eq('reference', paymentRef)
      .maybeSingle();

    if (intentErr || !intent) {
      console.warn(`[SeerBit Webhook] No matching payment intent for ref: ${paymentRef}`);
      // Record in processed_webhooks to prevent flooding
      await supabase.from('processed_webhooks').insert({
        event_id: eventId,
        provider: 'seerbit',
        event_type: payload.notificationType || payload.event || 'UNKNOWN',
        payload_hash: computePayloadHash(rawBody),
        status: 'IGNORED',
      });
      return NextResponse.json({ message: 'No matching intent found' }, { status: 200 });
    }

    // If intent was already processed
    if (intent.status === 'SUCCESS') {
      return NextResponse.json({ message: 'Payment intent already marked success' }, { status: 200 });
    }

    const isSuccessful =
      paymentStatus === 'SUCCESS' ||
      paymentStatus === 'SUCCESSFUL' ||
      paymentStatus === '00' ||
      gatewayMessage === 'SUCCESSFUL' ||
      payments.gatewayCode === '00';

    if (isSuccessful) {
      const amountKobo = intent.amount_kobo || Math.round(rawAmount * 100);

      // Resolve entity identity and customer details
      let entityName =
        intent.metadata?.parent_name ||
        intent.metadata?.school_name ||
        intent.metadata?.admin_name ||
        payments.customer?.name;
      let userEmail =
        intent.metadata?.parent_email ||
        intent.metadata?.admin_email ||
        payments.customer?.email;
      let userPhone =
        intent.metadata?.parent_phone ||
        payments.customer?.phone;

      const entityType =
        intent.metadata?.entity_type === 'school' || paymentRef.startsWith('MYEDU-SCH-')
          ? 'SCHOOL'
          : intent.metadata?.entity_type === 'escort' || paymentRef.startsWith('MYEDU-ESC-')
          ? 'ESCORT'
          : 'PARENT';

      // Fallback: look up user_profiles if needed
      if (!userEmail && intent.user_id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('full_name, email, phone')
          .eq('id', intent.user_id)
          .maybeSingle();

        if (profile) {
          entityName = entityName || profile.full_name;
          userEmail = userEmail || profile.email;
          userPhone = userPhone || profile.phone;
        }
      }

      entityName = entityName || (entityType === 'SCHOOL' ? 'School Administration' : 'Valued Parent');
      userEmail = userEmail || 'billing@myeduride.com';

      const gatewayRef = payments.gatewayReference || payments.paymentReference || paymentRef;
      const paymentChannel = payments.paymentType || payments.channelType || 'SEERBIT_CHECKOUT';

      // Generate Standardized Cryptographic Receipt
      const receiptData = generateReceipt({
        transactionReference: paymentRef,
        gatewayReference: gatewayRef,
        entityType,
        entityName,
        userEmail,
        userPhone,
        amountKobo,
        paymentChannel,
        timestamp: new Date(),
        description:
          entityType === 'SCHOOL'
            ? 'Institutional Wallet Deposit (Safe Passage & Gate Security)'
            : 'Wallet Deposit Credit (Safe Shuttle & Gate Pass)',
      });

      // 5. Execute Atomic Wallet Credit via Stored Procedure (FOR UPDATE row-lock)
      const { data: creditResult, error: creditErr } = await supabase.rpc(
        'execute_atomic_wallet_credit',
        {
          p_wallet_id: intent.wallet_id,
          p_amount_kobo: amountKobo,
          p_channel: 'SEERBIT_CHECKOUT',
          p_reference: paymentRef,
          p_description: `Wallet deposit via SeerBit (${payments.paymentType || 'Online Checkout'})`,
          p_metadata: {
            seerbit_reference: gatewayRef,
            channel_type: payments.channelType || 'CARD',
            customer: payments.customer || {},
            verified_via: 'WEBHOOK',
            receipt: receiptData,
          },
          p_payment_intent_id: intent.id,
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

      // Update intent status and store receipt
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

      // Dispatch notification
      const amountNgn = (amountKobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 });
      await supabase.from('notifications').insert({
        user_id: intent.user_id,
        title: 'Wallet Funded Successfully! 💳',
        message: `Your MyEduRide wallet has been credited with ₦${amountNgn}. Your school shuttle rides are active and funded.`,
        type: 'wallet_credit',
        is_read: false,
      });

      console.log(`[SeerBit Webhook] Successfully credited wallet ${intent.wallet_id} with ₦${amountNgn} (ref: ${paymentRef})`);
      return NextResponse.json({ status: 'success', credit: creditResult, receipt: receiptData }, { status: 200 });
    } else {
      // Payment failed or cancelled
      await supabase
        .from('payment_intents')
        .update({
          status: 'FAILED',
          seerbit_reference: payments.gatewayReference || paymentRef,
          updated_at: new Date().toISOString(),
        })
        .eq('id', intent.id);

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
