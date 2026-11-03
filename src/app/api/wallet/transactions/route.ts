import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAdminClient } from '@/lib/supabase/admin';
import { getOrCreateSchoolWallet } from '@/lib/school/school-wallet';
import { getOrCreateEscortWallet } from '@/lib/escort/escort-wallet';

export const dynamic = 'force-dynamic';

/**
 * GET /api/wallet/transactions
 *
 * Implements Daisaf Wallet System Specification Section 8:
 * Immutable double-entry ledger query endpoint with pagination and channel filtering.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedWalletId = searchParams.get('wallet_id');
    const requestedEntityType = searchParams.get('entity_type');
    const requestedSchoolId = searchParams.get('school_id');
    const channelFilter = searchParams.get('channel');
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 50), 1), 100);
    const offset = Math.max(Number(searchParams.get('offset') || 0), 0);

    const supabase = getAdminClient();
    const isSuperAdmin = session.roles?.some((r) => r.role === 'super_admin');
    const isSchoolAdmin = session.roles?.some((r) => r.role === 'school_admin' || r.role === 'super_admin');
    const isEscort = session.roles?.some((r) => r.role === 'escort' || r.role === 'school_escort');

    let targetWalletId = requestedWalletId;
    let resolvedEntityType = requestedEntityType || 'parent';

    // 1. Daisaf Company Revenue Ledger (Super Admin Oversight)
    if (requestedEntityType === 'daisaf') {
      if (!isSuperAdmin) {
        return NextResponse.json({ error: 'Forbidden: Super Admin access required for Daisaf revenue ledger' }, { status: 403 });
      }
      const { data: daisafWallet } = await supabase
        .from('wallets')
        .select('id')
        .in('entity_type', ['daisaf', 'platform_treasury'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      targetWalletId = daisafWallet?.id;
      resolvedEntityType = 'daisaf';
    } else if (requestedSchoolId || (isSchoolAdmin && requestedEntityType === 'school')) {
      // 2. School Institutional Ledger
      const schoolId = requestedSchoolId || session.roles?.find((r) => r.school_id)?.school_id;
      if (!schoolId) {
        return NextResponse.json({ error: 'school_id could not be resolved' }, { status: 400 });
      }
      const schoolWallet = await getOrCreateSchoolWallet(schoolId);
      targetWalletId = schoolWallet.id;
      resolvedEntityType = 'school';
    } else if (requestedEntityType === 'escort' || isEscort) {
      // 3. Escort Earnings Ledger
      const escortWallet = await getOrCreateEscortWallet(session.user_id);
      if (!escortWallet) {
        return NextResponse.json({ error: 'Escort wallet not found' }, { status: 404 });
      }
      targetWalletId = escortWallet.walletId;
      resolvedEntityType = 'escort';
    } else if (!targetWalletId) {
      // 4. Default: Parent Transit Ledger
      const { data: parentWallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', session.user_id)
        .eq('entity_type', 'parent')
        .maybeSingle();

      targetWalletId = parentWallet?.id;
      resolvedEntityType = 'parent';
    }

    if (!targetWalletId) {
      return NextResponse.json({
        success: true,
        transactions: [],
        pagination: { total: 0, limit, offset },
      });
    }

    // 5. Query Transactions from Immutable Ledger
    let query = supabase
      .from('wallet_transactions')
      .select('*', { count: 'exact' })
      .or(`wallet_id.eq.${targetWalletId},counterpart_wallet_id.eq.${targetWalletId}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (channelFilter) {
      query = query.eq('channel', channelFilter);
    }

    const { data: txList, count, error } = await query;
    if (error) {
      console.error('[GET /api/wallet/transactions] DB error:', error);
      return NextResponse.json({ error: 'Failed to fetch ledger transactions' }, { status: 500 });
    }

    const formattedTransactions = (txList || []).map((tx) => ({
      ...tx,
      amount_ngn: Number(tx.amount_kobo) / 100,
      balance_before_ngn: Number(tx.balance_before_kobo) / 100,
      balance_after_ngn: Number(tx.balance_after_kobo) / 100,
      is_debit: tx.transaction_type === 'DEBIT',
      is_credit: tx.transaction_type === 'CREDIT',
    }));

    return NextResponse.json({
      success: true,
      wallet_id: targetWalletId,
      entity_type: resolvedEntityType,
      transactions: formattedTransactions,
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (err: any) {
    console.error('[GET /api/wallet/transactions] Crash:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
