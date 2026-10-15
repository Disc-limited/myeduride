import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAdminClient } from '@/lib/supabase/admin';
import { SeerBitClient } from '@/lib/payments/seerbit';
import { getOrCreateSchoolWallet } from '@/lib/school/school-wallet';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rawAmount = Number(body.amount_ngn ?? body.amount);
    const requestedSchoolId = body.school_id;

    // Minimum institutional deposit: ₦1,000
    if (isNaN(rawAmount) || rawAmount < 1000) {
      return NextResponse.json(
        { error: 'Minimum institutional deposit amount is ₦1,000' },
        { status: 400 }
      );
    }

    // Velocity Anomaly Limit (Cybersecurity Plan: Max institutional deposit ₦5,000,000)
    if (rawAmount > 5000000) {
      return NextResponse.json(
        { error: 'Maximum single deposit amount is ₦5,000,000' },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    // 1. Zero-IDOR Role Check
    const { data: userRoles, error: rolesErr } = await supabase
      .from('user_school_roles')
      .select('school_id, role, is_active')
      .eq('user_id', session.user_id)
      .eq('is_active', true);

    if (rolesErr) {
      return NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 });
    }

    const isSuperAdmin = (userRoles || []).some((r) => r.role === 'super_admin');
    const adminSchoolIds = (userRoles || [])
      .filter((r) => r.role === 'school_admin' || r.role === 'super_admin')
      .map((r) => r.school_id)
      .filter(Boolean);

    let targetSchoolId: string | null = null;
    if (requestedSchoolId) {
      if (!isSuperAdmin && !adminSchoolIds.includes(requestedSchoolId)) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient privileges for specified school' },
          { status: 403 }
        );
      }
      targetSchoolId = requestedSchoolId;
    } else {
      targetSchoolId = adminSchoolIds[0] || null;
    }

    if (!targetSchoolId) {
      return NextResponse.json(
        { error: 'No associated school found with school administrator privileges' },
        { status: 403 }
      );
    }

    // 2. Fetch or provision school wallet
    const { wallet, school } = await getOrCreateSchoolWallet(targetSchoolId);
    if (!wallet) {
      return NextResponse.json({ error: 'School wallet could not be retrieved' }, { status: 500 });
    }

    const amountKobo = Math.round(rawAmount * 100);

    // 3. Deterministic payment reference and idempotency key
    const uniqueSuffix =
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    const reference = `MYEDU-SCH-${targetSchoolId.slice(0, 6).toUpperCase()}-${uniqueSuffix}`;
    const idempotencyKey = `IDEMP-${reference}`;

    // 4. Persist Payment Intent
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
        initiated_at: new Date().toISOString(),
      },
    });

    if (intentErr) {
      console.error('[SchoolDeposit API] intent insert error:', intentErr);
      return NextResponse.json({ error: 'Could not create payment intent' }, { status: 500 });
    }

    // 5. Initialize SeerBit Checkout session
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

      return NextResponse.json(
        { error: initRes.error || 'Failed to initialize SeerBit checkout' },
        { status: 502 }
      );
    }

    // 6. Update intent to PENDING_GATEWAY
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
    console.error('[SchoolDeposit API] exception:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
