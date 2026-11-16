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
    const supabase = getAdminClient();

    // 0. Resolve active agreed daily fee from transport bookings
    const { data: parentBookings } = await supabase
      .from('transport_bookings')
      .select('id, notes, fare_amount, status')
      .eq('parent_user_id', session.user_id)
      .not('status', 'in', '(cancelled,canceled,rejected)')
      .order('created_at', { ascending: false })
      .limit(5);

    let agreedDailyFee = 1060; // Standard 1 km baseline default
    if (parentBookings && parentBookings.length > 0) {
      for (const pb of parentBookings) {
        if (pb.notes) {
          try {
            const meta = typeof pb.notes === 'string' ? JSON.parse(pb.notes) : pb.notes;
            const fare = Number(
              meta.fare_correction?.discountedFare ||
              meta.discount?.discountedFare ||
              meta.daily_fare ||
              meta.fareResult?.dailyFare ||
              pb.fare_amount ||
              0
            );
            if (fare > 0) {
              agreedDailyFee = fare;
              break;
            }
          } catch {}
        }
      }
    }

    const minAmount = agreedDailyFee;
    const maxMonthlyAmount = agreedDailyFee * 20; // Maximum allowed payment is 1 school month (20 days)

    if (isNaN(rawAmount) || rawAmount < minAmount) {
      return NextResponse.json(
        { error: `The least amount payable is ₦${minAmount.toLocaleString()} (the agreed daily transit fee for 1 day).` },
        { status: 400 }
      );
    }

    // Maximum payment constraint: Parents are only expected to pay for a month (20 school days)
    if (rawAmount > maxMonthlyAmount) {
      return NextResponse.json(
        { error: `Parents are only expected to pay for a maximum of 1 month (20 school days: ₦${maxMonthlyAmount.toLocaleString()}).` },
        { status: 400 }
      );
    }

    const amountKobo = Math.round(rawAmount * 100);

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
