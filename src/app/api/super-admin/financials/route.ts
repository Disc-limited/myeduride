import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session || !sessionHasRole(session, 'super_admin')) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  try {
    const supabase = getAdminClient();

    // 1. Fetch all wallets, transactions, users, and schools in parallel
    const [walletsRes, txRes, usersRes, schoolsRes, intentsRes] = await Promise.all([
      supabase
        .from('wallets')
        .select('*')
        .order('updated_at', { ascending: false }),

      supabase
        .from('wallet_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200),

      supabase
        .from('user_profiles')
        .select('id, full_name, email, role, phone'),

      supabase
        .from('schools')
        .select('id, name, logo_url'),

      supabase
        .from('payment_intents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const usersMap = new Map<string, any>();
    (usersRes.data || []).forEach((u) => usersMap.set(u.id, u));

    const schoolsMap = new Map<string, any>();
    (schoolsRes.data || []).forEach((s) => schoolsMap.set(s.id, s));

    // 2. Format Wallets with enriched profile and school information
    const wallets = (walletsRes.data || []).map((w) => {
      const user = w.user_id ? usersMap.get(w.user_id) : null;
      const school = w.school_id ? schoolsMap.get(w.school_id) : null;

      let displayName = 'System / Treasury';
      if (w.entity_type === 'school') {
        displayName = school?.name || w.virtual_account_name || 'School Account';
      } else if (user?.full_name) {
        displayName = user.full_name;
      } else if (w.virtual_account_name) {
        displayName = w.virtual_account_name;
      } else if (w.payout_account_name) {
        displayName = w.payout_account_name;
      }

      return {
        ...w,
        owner_name: displayName,
        owner_email: user?.email || null,
        owner_phone: user?.phone || null,
        school_name: school?.name || null,
        available_balance_ngn: (w.available_balance_kobo || 0) / 100,
        reserved_balance_ngn: (w.reserved_balance_kobo || 0) / 100,
        pending_earnings_ngn: (w.pending_earnings_kobo || 0) / 100,
      };
    });

    // 3. Format Transactions with enriched owner details
    const walletMap = new Map<string, any>();
    wallets.forEach((w) => walletMap.set(w.id, w));

    const transactions = (txRes.data || []).map((t) => {
      const wallet = walletMap.get(t.wallet_id);
      return {
        ...t,
        amount_ngn: (t.amount_kobo || 0) / 100,
        balance_after_ngn: (t.balance_after_kobo || 0) / 100,
        balance_before_ngn: (t.balance_before_kobo || 0) / 100,
        wallet_entity_type: wallet?.entity_type || 'unknown',
        wallet_owner_name: wallet?.owner_name || 'Unknown Account',
        wallet_owner_email: wallet?.owner_email || null,
      };
    });

    // 4. Calculate Aggregate Metrics
    const totalAvailableNgn = wallets.reduce((acc, w) => acc + w.available_balance_ngn, 0);
    const totalPendingNgn = wallets.reduce((acc, w) => acc + w.pending_earnings_ngn, 0);
    const totalTransactionsCount = transactions.length;

    const totalDepositsNgn = transactions
      .filter((t) => t.transaction_type === 'CREDIT' && (t.channel?.includes('SEERBIT') || t.channel?.includes('DEPOSIT') || t.channel?.includes('CARD')))
      .reduce((acc, t) => acc + t.amount_ngn, 0);

    const totalPlatformRevenueNgn = transactions
      .filter((t) => t.channel?.includes('PLATFORM_COMMISSION') || t.wallet_entity_type === 'platform_treasury')
      .reduce((acc, t) => acc + t.amount_ngn, 0);

    return NextResponse.json({
      summary: {
        total_available_ngn: totalAvailableNgn,
        total_pending_ngn: totalPendingNgn,
        total_deposits_ngn: totalDepositsNgn,
        total_platform_revenue_ngn: totalPlatformRevenueNgn,
        total_wallets_count: wallets.length,
        total_transactions_count: totalTransactionsCount,
      },
      wallets,
      transactions,
      payment_intents: intentsRes.data || [],
    });
  } catch (error: any) {
    console.error('[super-admin/financials] Error fetching financial data:', error);
    return NextResponse.json({ error: error.message || 'Failed to load financial records' }, { status: 500 });
  }
}

