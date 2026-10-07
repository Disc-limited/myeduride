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
    const rawAmount = Number(body.amount_ngn ?? body.amount);

    if (isNaN(rawAmount) || rawAmount < 500) {
      return NextResponse.json(
        { error: 'Minimum deposit amount is ₦500' },
        { status: 400 }
      );
    }

    // Velocity Anomaly Limit (Cybersecurity Plan Section 3.4: Max single parent deposit ₦500,000)
    if (rawAmount > 500000) {
      return NextResponse.json(
        { error: 'Maximum single deposit amount is ₦500,000' },
        { status: 400 }
      );
    }

    const amountKobo = Math.round(rawAmount * 100);
    const supabase = getAdminClient();

    // 1. Fetch parent wallet
    const { data: userWallets } = await supabase
      .from('wallets')
      .select('id, entity_type')
      .eq('user_id', session.user_id);

    let wallet = userWallets?.find((w) => w.entity_type === 'parent') || userWallets?.[0] || null;

    if (!wallet) {
      const parentSchoolId = session.roles?.find((r) => r.school_id)?.school_id || null;
      const { data: newWallet, error: createErr } = await supabase
        .from('wallets')
        .insert({
          user_id: session.user_id,
          entity_type: 'parent',
          school_id: parentSchoolId,
          available_balance_kobo: 0,
          currency: 'NGN',
        })
        .select('id, entity_type')
        .single();

      if (createErr || !newWallet) {
        return NextResponse.json({ error: 'Failed to initialize wallet' }, { status: 500 });
      }
      wallet = newWallet;
    }

    if (!wallet) {
      return NextResponse.json({ error: 'Parent wallet not found' }, { status: 404 });
    }

    // 2. Deterministic payment reference and idempotency key
    const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    const reference = `MYEDU-DEP-${session.user_id.slice(0, 6).toUpperCase()}-${uniqueSuffix}`;
    const idempotencyKey = `IDEMP-${reference}`;

    // 3. Persist Intent First (Pillar 3 Architecture standard)
    const { error: intentErr } = await supabase
      .from('payment_intents')
      .insert({
        idempotency_key: idempotencyKey,
        wallet_id: wallet.id,
        user_id: session.user_id,
        amount_kobo: amountKobo,
        currency: 'NGN',
        payment_method: 'seerbit_checkout',
        reference,
        status: 'INTENT_CREATED',
        metadata: {
          parent_name: session.full_name,
          parent_email: session.email,
          parent_phone: session.phone,
          initiated_at: new Date().toISOString(),
        },
      });

    if (intentErr) {
      console.error('[Deposit API] intent insert error:', intentErr);
      return NextResponse.json({ error: 'Could not create payment intent' }, { status: 500 });
    }

    // 4. Initialize SeerBit Checkout session
    const callbackUrl = `${request.nextUrl.origin}/dashboard/parent?tab=wallet&reference=${reference}`;
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

      return NextResponse.json(
        { error: initRes.error || 'Failed to initialize SeerBit checkout' },
        { status: 502 }
      );
    }

    // 5. Update intent to PENDING_GATEWAY
    await supabase
      .from('payment_intents')
      .update({ status: 'PENDING_GATEWAY', updated_at: new Date().toISOString() })
      .eq('reference', reference);

    return NextResponse.json({
      success: true,
      reference,
      amount_ngn: rawAmount,
      amount_kobo: amountKobo,
      checkout_url: initRes.checkoutUrl,
      public_key: initRes.publicKey,
    });
  } catch (err: any) {
    console.error('[Deposit API] exception:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
