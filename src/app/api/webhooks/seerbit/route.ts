import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  verifySeerbitWebhookSignature,
  isTimestampSkewValid,
  computePayloadHash,
  isSeerbitIpAllowed,
} from '@/lib/security/webhook-security';
import { generateReceipt } from '@/lib/payments/receipt-engine';
import { sendPaymentReceiptEmail } from '@/lib/notifications/email-templates/payment-receipt';

export const dynamic = 'force-dynamic';

/**
 * Universal SeerBit Webhook Normalizer
 * Handles all variants of SeerBit webhook payloads:
 *  1. Virtual Account Direct Transfer (notificationRequestItem with creditAccountNumber)
 *  2. Batched Notification Items Array (notificationItems[0].notificationRequestItem)
 *  3. Online Checkout (data.payments)
 *  4. Top-level Flat Webhook Payloads
 */
function extractSeerbitData(payload: any, rawBody: string) {
  const reqItem =
    payload.notificationRequestItem ||
    payload.notificationItems?.[0]?.notificationRequestItem;
  const innerData = reqItem?.data || payload.data || payload;
  const payments = innerData?.payments || innerData;

  // 1. Account Number Extraction (Dedicated Virtual Account NUBAN)
  const virtualAccountNumber = String(
    innerData.creditAccountNumber ||
    payments.creditAccountNumber ||
    payments.virtualAccount?.accountNumber ||
    innerData.virtualAccount?.accountNumber ||
    payments.accountNumber ||
    innerData.accountNumber ||
    payments.virtualAccountNumber ||
    innerData.virtualAccountNumber ||
    payments.virtual_account_number ||
    innerData.virtual_account_number ||
    payload.creditAccountNumber ||
    payload.accountNumber ||
    ''
  ).trim();

  // 2. Reference Extraction
  const paymentRef = String(
    payments.reference ||
    payments.paymentReference ||
    payments.linkingreference ||
    payments.linkingReference ||
    payments.transactionRef ||
    payments.transactionReference ||
    payments.sessionId ||
    innerData.sessionId ||
    innerData.transactionRef ||
    innerData.reference ||
    innerData.paymentReference ||
    payload.reference ||
    payload.paymentReference ||
    ''
  ).trim();

  // 3. Unique Event ID for Idempotency
  const eventId = String(
    reqItem?.eventId ||
    payload.eventId ||
    payments.gatewayReference ||
    payments.transactionId ||
    payments.sessionId ||
    innerData.sessionId ||
    paymentRef ||
    computePayloadHash(rawBody)
  ).trim();

  // 4. Financial Amount Extraction (NGN string or number e.g. "100.00" or 100)
  const rawAmount = Number(
    payments.amount ??
    innerData.amount ??
    payments.debitedAmount ??
    payload.amount ??
    0
  );

  // 5. Status & Code Resolution
  const paymentStatus = String(
    payments.status ||
    payments.gatewayCode ||
    payments.code ||
    innerData.status ||
    innerData.code ||
    reqItem?.eventType ||
    payload.status ||
    ''
  ).trim().toUpperCase();

  const gatewayMessage = String(
    payments.gatewayMessage ||
    payments.message ||
    innerData.gatewayMessage ||
    innerData.message ||
    payload.message ||
    ''
  ).trim().toUpperCase();

  const transactionType = String(
    payments.type ||
    innerData.type ||
    payload.type ||
    payments.paymentType ||
    ''
  ).trim().toUpperCase();

  // 6. Success Determination
  const isSuccessful =
    paymentStatus === 'SUCCESS' ||
    paymentStatus === 'SUCCESSFUL' ||
    paymentStatus === '00' ||
    paymentStatus === 'APPROVED' ||
    paymentStatus === 'TRANSACTION_SUCCESS' ||
    paymentStatus === 'TRANSACTION' ||
    gatewayMessage === 'SUCCESSFUL' ||
    gatewayMessage === 'APPROVED' ||
    gatewayMessage === 'SUCCESS' ||
    payments.gatewayCode === '00' ||
    (transactionType === 'TRANSFER' && (gatewayMessage === 'APPROVED' || gatewayMessage.includes('SUCCESS') || rawAmount > 0));

  return {
    virtualAccountNumber,
    paymentRef,
    eventId,
    rawAmount,
    paymentStatus,
    gatewayMessage,
    transactionType,
    isSuccessful,
    originatorName: payments.originatorName || innerData.originatorName,
    originatorAccountNumber: payments.originatorAccountnumber || innerData.originatorAccountnumber,
    creditAccountName: payments.creditAccountName || innerData.creditAccountName || payments.virtualAccount?.accountName,
    bankName: payments.virtualAccount?.bankName || innerData.bankName || payments.bankName,
    customer: payments.customer || innerData.customer || {},
    raw: payments,
  };
}

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

    // 1. Timing-Safe HMAC Signature Verification (if configured & enforced)
    if (!testBypass && candidateSecrets.length > 0 && signature) {
      const isValidSig = verifySeerbitWebhookSignature(rawBody, signature, candidateSecrets);
      if (!isValidSig) {
        console.warn('[SeerBit Webhook] Signature mismatch detected');
        // Only hard-reject if explicitly configured to strictly enforce HMAC signatures
        if (process.env.SEERBIT_ENFORCE_SIGNATURE === 'true') {
          return NextResponse.json({ error: 'Invalid cryptographic signature' }, { status: 401 });
        }
      }
    }

    // 2. Anti-Replay Timestamp Skew Check (if header supplied)
    const timestampHeader = request.headers.get('x-seerbit-timestamp');
    if (timestampHeader && !isTimestampSkewValid(timestampHeader, 5)) {
      console.warn('[SeerBit Webhook] Timestamp skew threshold exceeded');
      return NextResponse.json({ error: 'Timestamp skew threshold exceeded' }, { status: 400 });
    }

    // 3. Egress IP Allowlist Validation (if explicitly enabled)
    if (process.env.SEERBIT_ENFORCE_IP_ALLOWLIST === 'true') {
      const clientIp =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip');
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

    // Normalize incoming SeerBit payload structure
    const parsed = extractSeerbitData(payload, rawBody);
    console.log(
      `[SeerBit Webhook] Ingested event ${parsed.eventId} | Ref: ${parsed.paymentRef} | VA: ${parsed.virtualAccountNumber} | Amount: ₦${parsed.rawAmount}`
    );

    if (!parsed.paymentRef && !parsed.virtualAccountNumber) {
      console.warn('[SeerBit Webhook] Missing both payment reference and virtual account number in payload');
      return NextResponse.json({ error: 'Missing payment reference and account number' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // 4. Idempotency Check (Pillar 7: Idempotent Consumers)
    const { data: existingEvent } = await supabase
      .from('processed_webhooks')
      .select('id, status')
      .eq('event_id', parsed.eventId)
      .maybeSingle();

    if (existingEvent && existingEvent.status === 'SUCCESS') {
      console.log(`[SeerBit Webhook] Idempotent duplicate event ${parsed.eventId} already processed`);
      return NextResponse.json({ message: 'Event already processed' }, { status: 200 });
    }

    // 5. Dual Target Resolution: Dedicated Virtual Account OR Payment Intent (Card / USSD)
    let wallet: any = null;
    let intent: any = null;
    let isVirtualAccountTransfer = false;

    // Target A: Lookup wallet by dedicated virtual account NUBAN
    if (parsed.virtualAccountNumber) {
      const { data: vWallet } = await supabase
        .from('wallets')
        .select('*, user_profile:user_profiles!wallets_user_id_fkey(full_name, email, phone)')
        .eq('virtual_account_number', parsed.virtualAccountNumber)
        .maybeSingle();

      if (vWallet) {
        wallet = vWallet;
        isVirtualAccountTransfer = true;
      }
    }

    // Target B: Lookup wallet by virtual account reference / linking reference
    if (!wallet && parsed.paymentRef) {
      const { data: vWallet } = await supabase
        .from('wallets')
        .select('*, user_profile:user_profiles!wallets_user_id_fkey(full_name, email, phone)')
        .eq('virtual_account_reference', parsed.paymentRef)
        .maybeSingle();

      if (vWallet) {
        wallet = vWallet;
        isVirtualAccountTransfer = true;
      }
    }

    // Target C: Lookup payment intent for Card / USSD checkout
    if (!wallet && parsed.paymentRef) {
      const { data: foundIntent } = await supabase
        .from('payment_intents')
        .select('*, wallet:wallets(id, user_id, available_balance_kobo)')
        .eq('reference', parsed.paymentRef)
        .maybeSingle();

      if (foundIntent) {
        intent = foundIntent;
        wallet = foundIntent.wallet;
      }
    }

    if (!wallet) {
      console.warn(
        `[SeerBit Webhook] No matching wallet or intent found for ref: ${parsed.paymentRef}, account: ${parsed.virtualAccountNumber}`
      );
      await supabase.from('processed_webhooks').insert({
        event_id: parsed.eventId,
        provider: 'seerbit',
        event_type: parsed.paymentStatus || 'UNKNOWN',
        payload_hash: computePayloadHash(rawBody),
        status: 'IGNORED',
      });
      return NextResponse.json({ message: 'No matching wallet or intent found' }, { status: 200 });
    }

    // Check if payment intent was already credited
    if (intent && intent.status === 'SUCCESS') {
      return NextResponse.json({ message: 'Payment intent already marked success' }, { status: 200 });
    }

    // Effective transaction reference for ledger accounting
    const effectiveRef =
      parsed.paymentRef ||
      `SB-VA-${parsed.virtualAccountNumber || wallet.virtual_account_number}-${parsed.eventId}`;

    // Additional Duplicate Check against wallet_transactions ledger
    const { data: existingTx } = await supabase
      .from('wallet_transactions')
      .select('id')
      .eq('reference', effectiveRef)
      .maybeSingle();

    if (existingTx) {
      console.log(`[SeerBit Webhook] Transaction ${effectiveRef} already credited in ledger`);
      return NextResponse.json({ message: 'Transaction already credited' }, { status: 200 });
    }

    if (parsed.isSuccessful) {
      const amountKobo = intent?.amount_kobo || Math.round(parsed.rawAmount * 100);

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
        parsed.customer?.name ||
        parsed.customer?.fullName ||
        parsed.creditAccountName ||
        (entityType === 'SCHOOL' ? 'School Administration' : 'Parent');

      let userEmail =
        wallet.user_profile?.email ||
        intent?.metadata?.parent_email ||
        intent?.metadata?.admin_email ||
        parsed.customer?.email ||
        'billing@myeduride.com';

      let userPhone =
        wallet.user_profile?.phone ||
        intent?.metadata?.parent_phone ||
        parsed.customer?.phone ||
        parsed.customer?.mobile ||
        null;

      // Fallback: look up user_profiles if missing
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

      const bankName =
        parsed.bankName ||
        wallet.virtual_bank_name ||
        'Virtual Bank';

      const paymentChannel = isVirtualAccountTransfer
        ? 'BANK_TRANSFER'
        : parsed.raw?.paymentType || parsed.raw?.channelType || 'SEERBIT_CHECKOUT';

      const description = isVirtualAccountTransfer
        ? `Wallet deposit via Bank Transfer (${bankName} - ${parsed.virtualAccountNumber || wallet.virtual_account_number})`
        : `Wallet deposit via SeerBit (${paymentChannel})`;

      // 6. Generate Standardized Cryptographic Receipt
      const receiptData = generateReceipt({
        transactionReference: effectiveRef,
        gatewayReference: parsed.eventId || effectiveRef,
        entityType,
        entityName,
        userEmail,
        userPhone: userPhone || undefined,
        amountKobo,
        paymentChannel: isVirtualAccountTransfer ? 'Virtual Account Bank Transfer' : paymentChannel,
        timestamp: new Date(),
        description,
      });

      // 7. Execute Atomic Wallet Credit via Stored Procedure
      const { data: creditResult, error: creditErr } = await supabase.rpc(
        'execute_atomic_wallet_credit',
        {
          p_wallet_id: wallet.id,
          p_amount_kobo: amountKobo,
          p_channel: paymentChannel,
          p_reference: effectiveRef,
          p_description: description,
          p_metadata: {
            seerbit_reference: parsed.eventId || effectiveRef,
            channel_type: isVirtualAccountTransfer ? 'BANK_TRANSFER' : (parsed.raw?.channelType || 'CARD'),
            bank_name: bankName,
            account_number: parsed.virtualAccountNumber || wallet.virtual_account_number,
            originator_name: parsed.originatorName || null,
            originator_account: parsed.originatorAccountNumber || null,
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

      // Synchronize user_profiles wallet_balance for cross-table consistency
      if (wallet.user_id && creditResult?.balance_after_kobo) {
        await supabase
          .from('user_profiles')
          .update({ wallet_balance: Number(creditResult.balance_after_kobo) / 100 })
          .eq('id', wallet.user_id);
      }

      // Update payment_intent status if applicable
      if (intent?.id) {
        await supabase
          .from('payment_intents')
          .update({
            status: 'SUCCESS',
            seerbit_reference: parsed.eventId || effectiveRef,
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

      // Record successful webhook execution for idempotency
      await supabase.from('processed_webhooks').insert({
        event_id: parsed.eventId,
        provider: 'seerbit',
        event_type: parsed.paymentStatus || 'TRANSACTION_SUCCESSFUL',
        payload_hash: computePayloadHash(rawBody),
        status: 'SUCCESS',
      });

      // Asynchronous Email Receipt Dispatch
      sendPaymentReceiptEmail(receiptData).catch((emailErr) => {
        console.error('[SeerBit Webhook] sendPaymentReceiptEmail failed:', emailErr);
      });

      // Dispatch in-app notification to user
      const amountNgn = (amountKobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 });
      if (wallet.user_id) {
        await supabase.from('notifications').insert({
          user_id: wallet.user_id,
          title: 'Wallet Funded Successfully! 💳',
          message: `Your MyEduRide wallet has been credited with ₦${amountNgn} via direct bank transfer. Your balance is updated.`,
          type: 'wallet_credit',
          is_read: false,
        });
      }

      console.log(
        `[SeerBit Webhook] Successfully credited wallet ${wallet.id} with ₦${amountNgn} (ref: ${effectiveRef})`
      );
      return NextResponse.json(
        { status: 'success', credit: creditResult, receipt: receiptData },
        { status: 200 }
      );
    } else {
      // Payment reported failed
      if (intent?.id) {
        await supabase
          .from('payment_intents')
          .update({
            status: 'FAILED',
            seerbit_reference: parsed.eventId || effectiveRef,
            updated_at: new Date().toISOString(),
          })
          .eq('id', intent.id);
      }

      await supabase.from('processed_webhooks').insert({
        event_id: parsed.eventId,
        provider: 'seerbit',
        event_type: parsed.paymentStatus || 'TRANSACTION_FAILED',
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
