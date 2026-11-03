import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAdminClient } from '@/lib/supabase/admin';
import { WithdrawalCustodyEngine } from '@/lib/security/withdrawal-custody';
import { getOrCreateEscortWallet } from '@/lib/escort/escort-wallet';
import { getOrCreateSchoolWallet } from '@/lib/school/school-wallet';

export const dynamic = 'force-dynamic';

/**
 * POST /api/wallet/withdraw
 *
 * Implements Daisaf Wallet System Specification Section 4.2, Section 5 & Section 8:
 * - Escort Emergency Withdrawal / Parent Withdrawal / School Withdrawal
 * - Maker-Checker initiation step:
 *   1. User submits withdrawal with Amount, Bank Details, and Mandatory Reason
 *   2. System reserves available balance into reserved_balance_kobo
 *   3. Enters compliance queue for Accountant vetting and Super Admin approval
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rawAmount = Number(body.amount_ngn ?? body.amount);
    const amountKoboInput = body.amount_kobo ? Number(body.amount_kobo) : undefined;
    const amountKobo = amountKoboInput ?? (isNaN(rawAmount) ? 0 : Math.round(rawAmount * 100));

    const bankCode = String(body.bank_code ?? body.bankCode ?? '').trim();
    const bankName = String(body.bank_name ?? body.bankName ?? '').trim();
    const accountNumber = String(body.account_number ?? body.accountNumber ?? '').trim();
    const accountName = String(body.account_name ?? body.accountName ?? '').trim();
    const reason = String(body.reason ?? body.narration ?? '').trim();

    // 1. Mandatory Reason Check (Daisaf Spec Section 4.2 & 5)
    if (!reason || reason.length < 5) {
      return NextResponse.json(
        { error: 'A specific reason for withdrawal is mandatory for compliance review (minimum 5 characters).' },
        { status: 400 }
      );
    }

    // 2. Minimum Withdrawal Check (₦1,000 / 100,000 Kobo)
    if (amountKobo < 100000) {
      return NextResponse.json(
        { error: 'Minimum withdrawal amount is ₦1,000 (100,000 kobo).' },
        { status: 400 }
      );
    }

    // 3. Bank Details Validation
    if (!accountNumber || accountNumber.length < 10 || !bankCode) {
      return NextResponse.json(
        { error: 'Valid bank code, bank name, and 10-digit NUBAN account number are required.' },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();
    const requestedEntityType = body.entity_type as string | undefined;
    const requestedWalletId = body.wallet_id as string | undefined;

    let targetWalletId = requestedWalletId;
    let targetEntityType = requestedEntityType;

    const isEscortRole = session.roles?.some((r) => r.role === 'escort' || r.role === 'school_escort');
    const isSchoolAdminRole = session.roles?.some((r) => r.role === 'school_admin' || r.role === 'super_admin');

    // 4. Resolve Target Wallet if not explicitly provided
    if (!targetWalletId) {
      if (requestedEntityType === 'escort' || isEscortRole) {
        const escortWallet = await getOrCreateEscortWallet(session.user_id);
        if (!escortWallet) {
          return NextResponse.json({ error: 'Escort wallet could not be resolved' }, { status: 404 });
        }
        targetWalletId = escortWallet.walletId;
        targetEntityType = 'escort';
      } else if (requestedEntityType === 'school' && isSchoolAdminRole) {
        const schoolId = body.school_id || session.roles?.find((r) => r.school_id)?.school_id;
        if (!schoolId) {
          return NextResponse.json({ error: 'school_id required for school withdrawal' }, { status: 400 });
        }
        const schoolWallet = await getOrCreateSchoolWallet(schoolId);
        targetWalletId = schoolWallet.id;
        targetEntityType = 'school';
      } else {
        // Default: Parent Wallet
        const { data: parentWallet } = await supabase
          .from('wallets')
          .select('id, available_balance_kobo')
          .eq('user_id', session.user_id)
          .eq('entity_type', 'parent')
          .maybeSingle();

        if (!parentWallet) {
          return NextResponse.json({ error: 'Parent wallet not found or unfunded' }, { status: 404 });
        }
        targetWalletId = parentWallet.id;
        targetEntityType = 'parent';
      }
    }

    // 5. Submit through Financial Withdrawal Custody Engine
    const result = await WithdrawalCustodyEngine.requestWithdrawal({
      walletId: targetWalletId!,
      userId: session.user_id,
      entityType: (targetEntityType as 'school' | 'parent' | 'escort') || 'parent',
      amountKobo,
      bankCode,
      bankName: bankName || 'Commercial Bank',
      accountNumber,
      accountName: accountName || session.full_name || 'Account Beneficiary',
      narration: reason,
      makerUserId: session.user_id,
    });

    return NextResponse.json({
      success: true,
      message: 'Withdrawal request submitted successfully for compliance vetting.',
      request: {
        id: result.id,
        status: result.status,
        amount_kobo: result.amount_kobo,
        amount_ngn: result.amount_kobo / 100,
        bank_name: result.bank_name,
        account_number: result.account_number,
        account_name: result.account_name,
        reason: result.narration,
        created_at: result.created_at,
      },
    });
  } catch (err: any) {
    console.error('[POST /api/wallet/withdraw] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to submit withdrawal request' },
      { status: 400 }
    );
  }
}
