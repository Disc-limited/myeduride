import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAdminClient } from '@/lib/supabase/admin';
import { SeerBitClient } from '@/lib/payments/seerbit';
import { getOrCreateSchoolWallet } from '@/lib/school/school-wallet';

export const dynamic = 'force-dynamic';

/**
 * POST /api/wallet/deposit
 *
 * Implements Daisaf Wallet System Specification Section 2.1, 3.1 & Section 8:
 * Unified wallet deposit endpoint for Institutional (School) and Retail (Parent) accounts.
 *
 * Rules:
 * - School institutional deposit: Minimum ₦10,000 (1,000,000 kobo), max ₦5,000,000
 * - Parent transit deposit: Minimum ₦500 (50,000 kobo), max ₦500,000
 * - Deterministic reference and idempotency key
 * - Payment Intent creation in database before gateway redirection
 * - SeerBit Checkout integration
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rawAmount = Number(body.amount_ngn ?? body.amount);
    const requestedEntityType = body.entity_type as string | undefined;
    const requestedSchoolId = body.school_id as string | undefined;

    if (isNaN(rawAmount) || rawAmount <= 0) {
      return NextResponse.json({ error: 'Invalid deposit amount' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const isSuperAdmin = session.roles?.some((r) => r.role === 'super_admin');
    const isSchoolAdmin = session.roles?.some((r) => r.role === 'school_admin' || r.role === 'super_admin');

    // 1. Determine whether this is a School or Parent deposit
    const isSchoolTarget = requestedEntityType === 'school' || Boolean(requestedSchoolId) || (isSchoolAdmin && requestedEntityType !== 'parent');

    if (isSchoolTarget) {
      // --- SCHOOL WALLET DEPOSIT (Pay-As-You-Go Gate & Escort Funding) ---
      let targetSchoolId = requestedSchoolId;
      if (!targetSchoolId) {
        targetSchoolId = session.roles?.find((r) => r.role === 'school_admin' || r.role === 'super_admin')?.school_id;
      }

      if (!targetSchoolId) {
        return NextResponse.json({ error: 'school_id could not be resolved for institutional deposit' }, { status: 400 });
      }

      // Authorization check: User must be school_admin for this school or super_admin
      const hasPermission = isSuperAdmin || session.roles?.some((r) => r.school_id === targetSchoolId && (r.role === 'school_admin' || r.role === 'super_admin'));
      if (!hasPermission) {
        return NextResponse.json({ error: 'Forbidden: Insufficient permissions for specified school' }, { status: 403 });
      }

      // Fetch School for custom min funding settings
      const { data: schoolRecord } = await supabase
        .from('schools')
        .select('id, name, min_school_funding_kobo')
        .eq('id', targetSchoolId)
        .maybeSingle();

      const minSchoolFundingNgn = (schoolRecord?.min_school_funding_kobo ? Number(schoolRecord.min_school_funding_kobo) : 1000000) / 100;

      // Daisaf Spec Section 2.1: Minimum wallet funding ₦10,000
      if (rawAmount < minSchoolFundingNgn) {
        return NextResponse.json(
          { error: `Minimum school wallet funding amount is ₦${minSchoolFundingNgn.toLocaleString()}` },
          { status: 400 }
        );
      }

      // Maximum single deposit anomaly check: ₦5,000,000
      if (rawAmount > 5000000) {
        return NextResponse.json({ error: 'Maximum single deposit amount is ₦5,000,000' }, { status: 400 });
      }

      const { wallet, school } = await getOrCreateSchoolWallet(targetSchoolId);
      if (!wallet) {
        return NextResponse.json({ error: 'School wallet could not be retrieved' }, { status: 500 });
      }

      const amountKobo = Math.round(rawAmount * 100);
      const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
      const reference = `MYEDU-SCH-${targetSchoolId.slice(0, 6).toUpperCase()}-${uniqueSuffix}`;
      const idempotencyKey = `IDEMP-${reference}`;

      // Persist Intent First
      const { error: intentErr } = await supabase.from('payment_intents').insert({
        idempotency_key: idempotencyKey,
        wallet_id: wallet.id,
        user_id: session.user_id,
        amount_kobo: amountKobo,
        currency: 'NGN',
        payment_method: 'seerbit_checkout',
        reference,
        status: 'INTENT_CREATED',
        metadata: {
          entity_type: 'school',
          school_id: targetSchoolId,
          school_name: school.name,
          admin_user_id: session.user_id,
          admin_name: session.full_name,
          admin_email: session.email,
          purpose: 'gate_and_escort_pay_as_you_go_funding',
          initiated_at: new Date().toISOString(),
        },
      });

      if (intentErr) {
        console.error('[WalletDeposit API] School intent insert error:', intentErr);
        return NextResponse.json({ error: 'Could not create payment intent' }, { status: 500 });
      }

      const callbackUrl = `${request.nextUrl.origin}/api/wallet/callback?reference=${reference}`;
      const initRes = await SeerBitClient.initializePayment({
        amountNgn: rawAmount,
        email: session.email || 'school-finance@myeduride.com',
        fullName: school.name || 'MyEduRide Partner School',
        phoneNumber: session.phone || undefined,
        reference,
        callbackUrl,
      });

      if (!initRes.success) {
        await supabase
          .from('payment_intents')
          .update({ status: 'FAILED', updated_at: new Date().toISOString() })
          .eq('reference', reference);

        return NextResponse.json({ error: initRes.error || 'Failed to initialize payment gateway' }, { status: 502 });
      }

      await supabase
        .from('payment_intents')
        .update({ status: 'PENDING_GATEWAY', updated_at: new Date().toISOString() })
        .eq('reference', reference);

      return NextResponse.json({
        success: true,
        reference,
        entity_type: 'school',
        school_id: targetSchoolId,
        amount_ngn: rawAmount,
        amount_kobo: amountKobo,
        checkout_url: initRes.checkoutUrl,
        public_key: initRes.publicKey,
      });
    }

    // --- PARENT TRANSIT WALLET DEPOSIT ---
    if (rawAmount < 500) {
      return NextResponse.json({ error: 'Minimum deposit amount is ₦500' }, { status: 400 });
    }

    if (rawAmount > 500000) {
      return NextResponse.json({ error: 'Maximum single deposit amount is ₦500,000' }, { status: 400 });
    }

    const amountKobo = Math.round(rawAmount * 100);

    let { data: parentWallet } = await supabase
      .from('wallets')
      .select('id, entity_type')
      .eq('user_id', session.user_id)
      .eq('entity_type', 'parent')
      .maybeSingle();

    if (!parentWallet) {
      const parentSchoolId = session.roles?.find((r) => r.school_id)?.school_id || null;
      const { data: newWallet, error: createErr } = await supabase
        .from('wallets')
        .insert({
          user_id: session.user_id,
          entity_type: 'parent',
          school_id: parentSchoolId,
          available_balance_kobo: 0,
          currency: 'NGN',
          status: 'active',
        })
        .select('id, entity_type')
        .single();

      if (createErr || !newWallet) {
        return NextResponse.json({ error: 'Failed to initialize parent wallet' }, { status: 500 });
      }
      parentWallet = newWallet;
    }

    const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    const reference = `MYEDU-DEP-${session.user_id.slice(0, 6).toUpperCase()}-${uniqueSuffix}`;
    const idempotencyKey = `IDEMP-${reference}`;

    const { error: intentErr } = await supabase.from('payment_intents').insert({
      idempotency_key: idempotencyKey,
      wallet_id: parentWallet.id,
      user_id: session.user_id,
      amount_kobo: amountKobo,
      currency: 'NGN',
      payment_method: 'seerbit_checkout',
      reference,
      status: 'INTENT_CREATED',
      metadata: {
        entity_type: 'parent',
        parent_name: session.full_name,
        parent_email: session.email,
        parent_phone: session.phone,
        purpose: 'parent_transit_funding',
        initiated_at: new Date().toISOString(),
      },
    });

    if (intentErr) {
      console.error('[WalletDeposit API] Parent intent insert error:', intentErr);
      return NextResponse.json({ error: 'Could not create payment intent' }, { status: 500 });
    }

    const callbackUrl = `${request.nextUrl.origin}/api/wallet/callback?reference=${reference}`;
    const initRes = await SeerBitClient.initializePayment({
      amountNgn: rawAmount,
      email: session.email || `${session.username || 'parent'}@myeduride.com`,
      fullName: session.full_name || 'MyEduRide Parent',
      phoneNumber: session.phone || undefined,
      reference,
      callbackUrl,
    });

    if (!initRes.success) {
      await supabase
        .from('payment_intents')
        .update({ status: 'FAILED', updated_at: new Date().toISOString() })
        .eq('reference', reference);

      return NextResponse.json({ error: initRes.error || 'Failed to initialize payment gateway' }, { status: 502 });
    }

    await supabase
      .from('payment_intents')
      .update({ status: 'PENDING_GATEWAY', updated_at: new Date().toISOString() })
      .eq('reference', reference);

    return NextResponse.json({
      success: true,
      reference,
      entity_type: 'parent',
      amount_ngn: rawAmount,
      amount_kobo: amountKobo,
      checkout_url: initRes.checkoutUrl,
      public_key: initRes.publicKey,
    });
  } catch (err: any) {
    console.error('[POST /api/wallet/deposit] Crash:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
