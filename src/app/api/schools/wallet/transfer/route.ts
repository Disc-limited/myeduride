import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAuthorizedSchoolAdmin } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getOrCreateSchoolWallet } from '@/lib/school/school-wallet';

export const dynamic = 'force-dynamic';

/**
 * POST /api/schools/wallet/transfer
 * Atomically deducts funds from the school's wallet and disburses to an approved escort or driver.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const {
      recipient_id,
      recipient_name,
      recipient_code,
      recipient_type,
      recipient_phone,
      amount,
      narrative,
      school_id,
    } = body;

    const primarySchoolId =
      school_id ||
      (session as any).primary_school?.id ||
      session.roles?.find((r: any) => r.school_id)?.school_id;

    if (!primarySchoolId) {
      return NextResponse.json({ error: 'School ID could not be determined' }, { status: 400 });
    }

    if (!isAuthorizedSchoolAdmin(session, primarySchoolId)) {
      return NextResponse.json(
        { error: 'Access denied: School Admin role required' },
        { status: 403 }
      );
    }

    if (!recipient_name || !recipient_code) {
      return NextResponse.json(
        { error: 'Approved recipient details (name and escort/driver code) are required' },
        { status: 400 }
      );
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 100) {
      return NextResponse.json({ error: 'Minimum disbursement amount is ₦100' }, { status: 400 });
    }

    const amountKobo = Math.round(numAmount * 100);

    // 1. Fetch school wallet
    const { wallet, school } = await getOrCreateSchoolWallet(primarySchoolId);
    if (!wallet) {
      return NextResponse.json({ error: 'School wallet not found' }, { status: 404 });
    }

    if (wallet.available_balance_kobo < amountKobo) {
      const availNgn = (wallet.available_balance_kobo / 100).toLocaleString();
      return NextResponse.json(
        {
          error: `Insufficient funds. Your available wallet balance is ₦${availNgn}, but you attempted to disburse ₦${numAmount.toLocaleString()}.`,
        },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();
    const reference = `DISB-SCH-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const channel = recipient_type === 'escort' ? 'ESCORT_DISBURSEMENT' : 'STAFF_DISBURSEMENT';
    const description = `Disbursement to ${recipient_name} (${recipient_code})${
      narrative ? `: ${narrative}` : ''
    }`;

    // 2. Atomically deduct from school wallet
    const { data: deductResult, error: deductErr } = await supabase.rpc(
      'execute_atomic_wallet_deduction',
      {
        p_wallet_id: wallet.id,
        p_amount_kobo: amountKobo,
        p_channel: channel,
        p_reference: reference,
        p_description: description,
        p_metadata: {
          recipient_id,
          recipient_name,
          recipient_code,
          recipient_type: recipient_type || 'escort',
          recipient_phone: recipient_phone || null,
          narrative: narrative || null,
          disbursed_by_user_id: session.user_id,
          disbursed_by_name: (session as any).full_name || 'School Admin',
          school_id: primarySchoolId,
          school_name: school.name,
        },
      }
    );

    if (deductErr || !deductResult?.success) {
      console.error('[wallet/transfer POST] Deduction failed:', deductErr || deductResult);
      return NextResponse.json(
        { error: deductResult?.error || deductErr?.message || 'Transaction could not be executed' },
        { status: 500 }
      );
    }

    // 3. Atomically credit recipient's escort wallet (resolving and lazily provisioning if needed)
    let creditedWalletId = null;
    let targetUserId = null;

    // Check if recipient_id is already a user_id
    if (recipient_id && !recipient_id.startsWith('APP-') && !recipient_id.startsWith('veh-')) {
      const { data: userCheck } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', recipient_id)
        .maybeSingle();
      if (userCheck) targetUserId = userCheck.id;
    }

    // If not found, resolve from escort_applications
    if (!targetUserId && (recipient_id || recipient_code)) {
      const { data: appMatch } = await supabase
        .from('escort_applications')
        .select('user_id, email, phone')
        .or(`id.eq.${recipient_id},escort_code.eq.${recipient_code}`)
        .limit(1)
        .maybeSingle();

      if (appMatch?.user_id) {
        targetUserId = appMatch.user_id;
      } else if (appMatch?.email) {
        const { data: userByEmail } = await supabase
          .from('user_profiles')
          .select('id')
          .ilike('email', appMatch.email)
          .maybeSingle();
        if (userByEmail) targetUserId = userByEmail.id;
      }
    }

    // Fallback: search user_profiles by phone or name
    if (!targetUserId && recipient_phone) {
      const { data: userByPhone } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('phone', recipient_phone)
        .maybeSingle();
      if (userByPhone) targetUserId = userByPhone.id;
    }

    if (targetUserId) {
      // Find or provision recipient's escort wallet
      let { data: recipientWallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('entity_type', 'escort')
        .maybeSingle();

      if (!recipientWallet) {
        const { data: createdWallet } = await supabase
          .from('wallets')
          .insert({
            user_id: targetUserId,
            entity_type: 'escort',
            currency: 'NGN',
            available_balance_kobo: 0,
            status: 'active',
          })
          .select('id')
          .single();
        recipientWallet = createdWallet;
      }

      if (recipientWallet?.id) {
        creditedWalletId = recipientWallet.id;
        await supabase.rpc('execute_atomic_wallet_credit', {
          p_wallet_id: creditedWalletId,
          p_amount_kobo: amountKobo,
          p_channel: 'SCHOOL_STIPEND_CREDIT',
          p_reference: `${reference}-CREDIT`,
          p_description: `Stipend from ${school.name}: ${narrative || 'Service Disbursement'}`,
          p_metadata: {
            from_school_id: primarySchoolId,
            from_school_name: school.name,
            original_reference: reference,
            narrative: narrative || null,
          },
        });

        // Sync user_profiles wallet_balance
        const { data: curProf } = await supabase
          .from('user_profiles')
          .select('wallet_balance')
          .eq('id', targetUserId)
          .single();
        const updatedBal = Number(curProf?.wallet_balance || 0) + numAmount;
        await supabase
          .from('user_profiles')
          .update({ wallet_balance: updatedBal })
          .eq('id', targetUserId);

        // Link counterpart_wallet_id on the deduction transaction
        if (deductResult.transaction_id) {
          await supabase
            .from('wallet_transactions')
            .update({ counterpart_wallet_id: creditedWalletId })
            .eq('id', deductResult.transaction_id);
        }
      }
    }

    // 4. Log audit event
    await supabase.from('audit_logs').insert({
      school_id: primarySchoolId,
      user_id: session.user_id,
      action: 'WALLET_FUND_TRANSFER',
      resource: 'wallets',
      details: {
        reference,
        recipient_name,
        recipient_code,
        amount_ngn: numAmount,
        amount_kobo: amountKobo,
        credited_wallet_id: creditedWalletId,
      },
    });

    const newBalanceKobo = deductResult.balance_after_kobo;
    const newBalanceNgn = Number(newBalanceKobo) / 100;

    return NextResponse.json({
      success: true,
      reference,
      transaction_id: deductResult.transaction_id,
      amount_ngn: numAmount,
      balance_after_ngn: newBalanceNgn,
      message: `Successfully transferred ₦${numAmount.toLocaleString()} to ${recipient_name}!`,
    });
  } catch (err: any) {
    console.error('[wallet/transfer POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
