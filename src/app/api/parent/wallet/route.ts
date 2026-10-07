import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { SeerBitClient } from '@/lib/payments/seerbit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getAdminClient();

    // 1. Fetch or lazily initialize parent wallet
    const { data: userWallets, error: walletErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', session.user_id);

    console.log('[ParentWallet API] session.user_id:', session.user_id, 'userWallets:', userWallets, 'walletErr:', walletErr);

    if (walletErr) {
      console.error('[ParentWallet API] wallet select error:', walletErr);
      return NextResponse.json({ error: 'Failed to retrieve wallet', details: walletErr }, { status: 500 });
    }

    let wallet = userWallets?.find((w) => w.entity_type === 'parent') || userWallets?.[0] || null;

    // Lazy initialization if no wallet exists yet for this parent
    if (!wallet) {
      const parentSchoolId = session.roles?.find((r) => r.school_id)?.school_id || null;
      const ref = `VIRT-PAR-${session.user_id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
      
      const virtualAcc = await SeerBitClient.createVirtualAccount({
        fullName: session.full_name || 'MyEduRide Parent',
        email: session.email || 'parent@myeduride.com',
        phoneNumber: session.phone || undefined,
        reference: ref,
      });

      const { data: newWallet, error: createErr } = await supabase
        .from('wallets')
        .insert({
          user_id: session.user_id,
          entity_type: 'parent',
          school_id: parentSchoolId,
          available_balance_kobo: 0,
          reserved_balance_kobo: 0,
          escrow_balance_kobo: 0,
          locked_balance_kobo: 0,
          currency: 'NGN',
          virtual_account_number: virtualAcc.accountNumber || null,
          virtual_bank_name: virtualAcc.bankName || 'Wema Bank (SeerBit)',
          virtual_account_name: virtualAcc.accountName || `MyEduRide / ${session.full_name}`,
          virtual_account_reference: ref,
          status: 'active',
        })
        .select()
        .single();

      if (createErr) {
        console.error('[ParentWallet API] wallet create error:', createErr);
        return NextResponse.json({ error: 'Failed to create wallet', details: createErr }, { status: 500 });
      }

      wallet = newWallet;
    }

    // 2. Fetch recent ledger transactions
    const { data: transactions } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false })
      .limit(20);

    // 3. Fetch active escrow holds
    const { data: escrowHolds } = await supabase
      .from('escrow_holds')
      .select('id, gross_amount_kobo, status, student_id, trip_id, created_at')
      .eq('parent_wallet_id', wallet.id)
      .eq('status', 'HELD')
      .order('created_at', { ascending: false });

    const availableKobo = Number(wallet.available_balance_kobo || 0);
    const escrowKobo = Number(wallet.escrow_balance_kobo || 0);
    const reservedKobo = Number(wallet.reserved_balance_kobo || 0);

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.id,
        currency: wallet.currency || 'NGN',
        available_balance_kobo: availableKobo,
        available_balance_ngn: availableKobo / 100,
        escrow_balance_kobo: escrowKobo,
        escrow_balance_ngn: escrowKobo / 100,
        reserved_balance_kobo: reservedKobo,
        reserved_balance_ngn: reservedKobo / 100,
        status: wallet.status || 'active',
        virtual_account: {
          account_number: wallet.virtual_account_number,
          bank_name: wallet.virtual_bank_name || 'Wema Bank (SeerBit)',
          account_name: wallet.virtual_account_name,
        },
      },
      transactions: (transactions || []).map((tx) => ({
        ...tx,
        amount_ngn: Number(tx.amount_kobo) / 100,
        balance_before_ngn: Number(tx.balance_before_kobo) / 100,
        balance_after_ngn: Number(tx.balance_after_kobo) / 100,
      })),
      escrow_holds: escrowHolds || [],
    });
  } catch (err: any) {
    console.error('[ParentWallet API] GET exception:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
