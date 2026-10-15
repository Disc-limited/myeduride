import { getAdminClient } from '@/lib/supabase/admin';
import { SeerBitClient } from '@/lib/payments/seerbit';

export interface SchoolWalletOverview {
  wallet: {
    id: string;
    school_id: string;
    school_name: string;
    currency: string;
    available_balance_kobo: number;
    available_balance_ngn: number;
    reserved_balance_kobo: number;
    reserved_balance_ngn: number;
    escrow_balance_kobo: number;
    escrow_balance_ngn: number;
    daily_gate_fee_kobo: number;
    daily_gate_fee_ngn: number;
    status: string;
    virtual_account: {
      account_number: string | null;
      bank_name: string;
      account_name: string | null;
    };
  };
  transactions: Array<{
    id: string;
    type: string;
    channel: string;
    amount_kobo: number;
    amount_ngn: number;
    balance_before_kobo: number;
    balance_before_ngn: number;
    balance_after_kobo: number;
    balance_after_ngn: number;
    reference: string;
    description: string;
    status: string;
    created_at: string;
    metadata?: any;
  }>;
  stats: {
    monthly_gate_deductions_kobo: number;
    monthly_gate_deductions_ngn: number;
    total_deposits_kobo: number;
    total_deposits_ngn: number;
  };
}

/**
 * Retrieves or lazily provisions an institutional wallet for a school.
 * Automatically equips the wallet with a dedicated virtual NUBAN for wire transfers.
 */
export async function getOrCreateSchoolWallet(schoolId: string): Promise<any> {
  const supabase = getAdminClient();

  // 1. Fetch school details
  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .select('id, name, address, daily_gate_fee_kobo')
    .eq('id', schoolId)
    .single();

  if (schoolErr || !school) {
    console.error('[SchoolWallet] School lookup error:', schoolErr);
    throw new Error(`School with ID ${schoolId} not found`);
  }

  // 2. Query existing school wallet
  const { data: existingWallets, error: walletErr } = await supabase
    .from('wallets')
    .select('*')
    .eq('school_id', schoolId)
    .eq('entity_type', 'school');

  if (walletErr) {
    console.error('[SchoolWallet] Error querying wallets:', walletErr);
    throw walletErr;
  }

  let wallet = existingWallets?.[0] || null;

  // 3. Atomically provision via stored procedure if absent
  if (!wallet) {
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('get_or_create_school_wallet', {
      p_school_id: schoolId,
    });

    if (rpcErr) {
      console.error('[SchoolWallet] Stored procedure failed:', rpcErr);
      throw rpcErr;
    }

    const { data: fetchedWallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', rpcResult.wallet_id)
      .single();

    wallet = fetchedWallet;
  }

  // 4. Ensure Dedicated Institutional Virtual NUBAN is generated
  if (wallet && !wallet.virtual_account_number) {
    try {
      const ref = `VIRT-SCH-${schoolId.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
      const virtualAcc = await SeerBitClient.createVirtualAccount({
        fullName: school.name || 'MyEduRide Partner School',
        email: (school as any).email || 'school-finance@myeduride.com',
        phoneNumber: (school as any).phone || undefined,
        reference: ref,
      });

      if (virtualAcc?.accountNumber) {
        const { data: updatedWallet } = await supabase
          .from('wallets')
          .update({
            virtual_account_number: virtualAcc.accountNumber,
            virtual_bank_name: virtualAcc.bankName || 'Wema Bank (SeerBit)',
            virtual_account_name: virtualAcc.accountName || `MyEduRide / ${school.name}`,
            virtual_account_reference: ref,
            updated_at: new Date().toISOString(),
          })
          .eq('id', wallet.id)
          .select()
          .single();

        if (updatedWallet) {
          wallet = updatedWallet;
        }
      }
    } catch (virtErr) {
      console.warn('[SchoolWallet] Non-fatal virtual account creation notice:', virtErr);
    }
  }

  return { wallet, school };
}

/**
 * Returns comprehensive financial overview for a school admin portal.
 */
export async function getSchoolWalletOverview(schoolId: string): Promise<SchoolWalletOverview> {
  const { wallet, school } = await getOrCreateSchoolWallet(schoolId);
  const supabase = getAdminClient();

  // 1. Fetch recent ledger transactions (last 30)
  const { data: transactions } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false })
    .limit(30);

  // 2. Compute this month's statistics
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: monthlyTx } = await supabase
    .from('wallet_transactions')
    .select('type, channel, amount_kobo')
    .eq('wallet_id', wallet.id)
    .gte('created_at', startOfMonth.toISOString());

  let monthlyGateKobo = 0;
  let totalDepositsKobo = 0;

  for (const tx of monthlyTx || []) {
    const kobo = Number(tx.amount_kobo || 0);
    if (tx.channel === 'DAILY_GATE_FEE' || (tx.type === 'DEBIT' && tx.channel === 'MAINTENANCE_FEE')) {
      monthlyGateKobo += kobo;
    } else if (tx.type === 'CREDIT') {
      totalDepositsKobo += kobo;
    }
  }

  const availableKobo = Number(wallet.available_balance_kobo || 0);
  const reservedKobo = Number(wallet.reserved_balance_kobo || 0);
  const escrowKobo = Number(wallet.escrow_balance_kobo || 0);
  const gateFeeKobo = Number(school.daily_gate_fee_kobo || 250000); // ₦2,500 default

  return {
    wallet: {
      id: wallet.id,
      school_id: school.id,
      school_name: school.name || 'Institutional Partner',
      currency: wallet.currency || 'NGN',
      available_balance_kobo: availableKobo,
      available_balance_ngn: availableKobo / 100,
      reserved_balance_kobo: reservedKobo,
      reserved_balance_ngn: reservedKobo / 100,
      escrow_balance_kobo: escrowKobo,
      escrow_balance_ngn: escrowKobo / 100,
      daily_gate_fee_kobo: gateFeeKobo,
      daily_gate_fee_ngn: gateFeeKobo / 100,
      status: wallet.status || 'active',
      virtual_account: {
        account_number: wallet.virtual_account_number || null,
        bank_name: wallet.virtual_bank_name || 'Wema Bank (SeerBit)',
        account_name: wallet.virtual_account_name || `MyEduRide / ${school.name}`,
      },
    },
    transactions: (transactions || []).map((tx) => ({
      ...tx,
      amount_kobo: Number(tx.amount_kobo),
      amount_ngn: Number(tx.amount_kobo) / 100,
      balance_before_kobo: Number(tx.balance_before_kobo),
      balance_before_ngn: Number(tx.balance_before_kobo) / 100,
      balance_after_kobo: Number(tx.balance_after_kobo),
      balance_after_ngn: Number(tx.balance_after_kobo) / 100,
    })),
    stats: {
      monthly_gate_deductions_kobo: monthlyGateKobo,
      monthly_gate_deductions_ngn: monthlyGateKobo / 100,
      total_deposits_kobo: totalDepositsKobo,
      total_deposits_ngn: totalDepositsKobo / 100,
    },
  };
}
