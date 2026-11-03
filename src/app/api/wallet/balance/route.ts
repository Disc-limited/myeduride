import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAdminClient } from '@/lib/supabase/admin';
import { getOrCreateSchoolWallet } from '@/lib/school/school-wallet';
import { getOrCreateEscortWallet } from '@/lib/escort/escort-wallet';

export const dynamic = 'force-dynamic';

/**
 * GET /api/wallet/balance
 *
 * Implements Daisaf Wallet System Specification Section 8:
 * Resolves current wallet balance, escrow holds, and virtual account details
 * for the authenticated entity (School, Parent, Escort, or Daisaf Revenue).
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);
    const requestedEntityType = searchParams.get('entity_type');
    const requestedSchoolId = searchParams.get('school_id');

    const isSuperAdmin = session.roles?.some((r) => r.role === 'super_admin');
    const isSchoolAdmin = session.roles?.some((r) => r.role === 'school_admin' || r.role === 'super_admin');
    const isEscort = session.roles?.some((r) => r.role === 'escort' || r.role === 'school_escort');

    // 1. Daisaf Company Revenue Wallet (Super Admin Oversight)
    if (requestedEntityType === 'daisaf' && isSuperAdmin) {
      const { data: daisafWallet } = await supabase
        .from('wallets')
        .select('*')
        .in('entity_type', ['daisaf', 'platform_treasury'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const balKobo = daisafWallet?.available_balance_kobo || 0;
      return NextResponse.json({
        success: true,
        wallet_id: daisafWallet?.id,
        entity_type: 'daisaf',
        currency: 'NGN',
        available_balance_kobo: balKobo,
        available_balance_ngn: balKobo / 100,
        reserved_balance_kobo: daisafWallet?.reserved_balance_kobo || 0,
        reserved_balance_ngn: (daisafWallet?.reserved_balance_kobo || 0) / 100,
        escrow_balance_kobo: daisafWallet?.escrow_balance_kobo || 0,
        escrow_balance_ngn: (daisafWallet?.escrow_balance_kobo || 0) / 100,
        status: daisafWallet?.status || 'active',
      });
    }

    // 2. School Institutional Wallet
    if (requestedSchoolId || (isSchoolAdmin && requestedEntityType === 'school')) {
      const targetSchoolId = requestedSchoolId || session.roles?.find((r) => r.school_id)?.school_id;
      if (!targetSchoolId) {
        return NextResponse.json({ error: 'school_id could not be determined' }, { status: 400 });
      }

      const schoolWallet = await getOrCreateSchoolWallet(targetSchoolId);
      const balKobo = schoolWallet.available_balance_kobo || 0;
      const resKobo = schoolWallet.reserved_balance_kobo || 0;
      const escKobo = schoolWallet.escrow_balance_kobo || 0;

      return NextResponse.json({
        success: true,
        wallet_id: schoolWallet.id,
        school_id: targetSchoolId,
        entity_type: 'school',
        currency: schoolWallet.currency || 'NGN',
        available_balance_kobo: balKobo,
        available_balance_ngn: balKobo / 100,
        reserved_balance_kobo: resKobo,
        reserved_balance_ngn: resKobo / 100,
        escrow_balance_kobo: escKobo,
        escrow_balance_ngn: escKobo / 100,
        status: schoolWallet.status || 'active',
        virtual_account: {
          account_number: schoolWallet.virtual_account_number || null,
          bank_name: schoolWallet.virtual_bank_name || 'Wema Bank (SeerBit)',
          account_name: schoolWallet.virtual_account_name || null,
        },
      });
    }

    // 3. Escort Earnings Wallet
    if (isEscort || requestedEntityType === 'escort') {
      const escortWallet = await getOrCreateEscortWallet(session.user_id);
      if (!escortWallet) {
        return NextResponse.json({ error: 'Escort wallet could not be resolved' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        wallet_id: escortWallet.walletId,
        user_id: escortWallet.userId,
        entity_type: 'escort',
        currency: 'NGN',
        available_balance_kobo: escortWallet.availableBalanceKobo,
        available_balance_ngn: escortWallet.availableBalanceNgn,
        reserved_balance_kobo: 0,
        reserved_balance_ngn: 0,
        escrow_balance_kobo: 0,
        escrow_balance_ngn: 0,
        status: 'active',
      });
    }

    // 4. Default: Parent Transit Wallet
    let { data: parentWallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', session.user_id)
      .eq('entity_type', 'parent')
      .maybeSingle();

    if (!parentWallet) {
      // Auto-provision parent wallet if absent
      const { data: newW, error: createErr } = await supabase
        .from('wallets')
        .insert({
          user_id: session.user_id,
          entity_type: 'parent',
          currency: 'NGN',
          available_balance_kobo: 0,
          status: 'active',
        })
        .select('*')
        .single();

      if (createErr) {
        console.error('[GET /api/wallet/balance] Failed to provision parent wallet:', createErr);
        return NextResponse.json({ error: 'Failed to provision wallet' }, { status: 500 });
      }
      parentWallet = newW;
    }

    const balKobo = parentWallet.available_balance_kobo || 0;
    const resKobo = parentWallet.reserved_balance_kobo || 0;
    const escKobo = parentWallet.escrow_balance_kobo || 0;

    return NextResponse.json({
      success: true,
      wallet_id: parentWallet.id,
      user_id: parentWallet.user_id,
      entity_type: 'parent',
      currency: parentWallet.currency || 'NGN',
      available_balance_kobo: balKobo,
      available_balance_ngn: balKobo / 100,
      reserved_balance_kobo: resKobo,
      reserved_balance_ngn: resKobo / 100,
      escrow_balance_kobo: escKobo,
      escrow_balance_ngn: escKobo / 100,
      status: parentWallet.status || 'active',
      virtual_account: {
        account_number: parentWallet.virtual_account_number || null,
        bank_name: parentWallet.virtual_bank_name || 'Wema Bank (SeerBit)',
        account_name: parentWallet.virtual_account_name || null,
      },
    });
  } catch (err: any) {
    console.error('[GET /api/wallet/balance] Crash:', err);
    return NextResponse.json({ error: err.message || 'Failed to retrieve balance' }, { status: 500 });
  }
}
