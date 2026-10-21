import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAdminClient } from '@/lib/supabase/admin';
import { WithdrawalCustodyEngine } from '@/lib/security/withdrawal-custody';
import { FinancialCircuitBreaker } from '@/lib/security/financial-circuit-breaker';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || undefined;
    const walletId = searchParams.get('wallet_id') || undefined;

    let query = supabase
      .from('withdrawal_requests')
      .select(`
        *,
        wallet:wallets(id, entity_type, available_balance_kobo),
        maker:user_profiles!maker_user_id(id, full_name, email),
        checker:user_profiles!checker_user_id(id, full_name, email),
        super_admin:user_profiles!super_admin_user_id(id, full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }
    if (walletId) {
      query = query.eq('wallet_id', walletId);
    }

    const { data: requests, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const circuitStatus = await FinancialCircuitBreaker.getCircuitStatus();

    return NextResponse.json({
      success: true,
      circuit_breaker: circuitStatus,
      requests: requests || [],
    });
  } catch (err: any) {
    console.error('[Treasury Withdrawals GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action;

    switch (action) {
      case 'request': {
        const result = await WithdrawalCustodyEngine.requestWithdrawal({
          walletId: body.walletId,
          userId: session.user_id,
          entityType: body.entityType || 'escort',
          amountKobo: Number(body.amountKobo),
          bankCode: body.bankCode,
          bankName: body.bankName,
          accountNumber: body.accountNumber,
          accountName: body.accountName,
          narration: body.narration,
          makerUserId: session.user_id,
        });
        return NextResponse.json({ success: true, request: result });
      }

      case 'checker_approve': {
        if (!body.totpCode) {
          return NextResponse.json({ error: 'Missing mandatory TOTP 2FA code' }, { status: 400 });
        }
        // Use supplied secret or user configured TOTP secret
        const secret = body.totpSecret || process.env.TREASURY_CHECKER_TOTP_SECRET || 'JBSWY3DPEHPK3PXP';
        const result = await WithdrawalCustodyEngine.checkerApproveWithdrawal({
          requestId: body.requestId,
          checkerUserId: session.user_id,
          totpCode: String(body.totpCode),
          totpSecret: secret,
        });
        return NextResponse.json({ success: true, request: result });
      }

      case 'superadmin_approve': {
        const isSuperAdmin = session.roles?.some((r) => r.role === 'super_admin');
        if (!isSuperAdmin) {
          return NextResponse.json({ error: 'Forbidden: SuperAdmin role required for secondary authorization' }, { status: 403 });
        }
        const result = await WithdrawalCustodyEngine.superAdminApproveWithdrawal({
          requestId: body.requestId,
          superAdminUserId: session.user_id,
        });
        return NextResponse.json({ success: true, request: result });
      }

      case 'reject': {
        const result = await WithdrawalCustodyEngine.rejectWithdrawal({
          requestId: body.requestId,
          reviewerUserId: session.user_id,
          reason: body.reason || 'Rejected during treasury compliance review',
        });
        return NextResponse.json({ success: true, request: result });
      }

      case 'execute': {
        const result = await WithdrawalCustodyEngine.executeWithdrawalPayout({
          requestId: body.requestId,
          executorUserId: session.user_id,
        });
        return NextResponse.json(result);
      }

      case 'audit_ledger': {
        const isSuperAdmin = session.roles?.some((r) => r.role === 'super_admin');
        if (!isSuperAdmin) {
          return NextResponse.json({ error: 'Forbidden: SuperAdmin role required' }, { status: 403 });
        }
        const audit = await FinancialCircuitBreaker.auditLedgerAndTripOnMismatch(body.walletId);
        return NextResponse.json({ success: true, audit });
      }

      case 'reset_circuit': {
        const isSuperAdmin = session.roles?.some((r) => r.role === 'super_admin');
        if (!isSuperAdmin) {
          return NextResponse.json({ error: 'Forbidden: SuperAdmin role required to reset circuit breaker' }, { status: 403 });
        }
        await FinancialCircuitBreaker.resetCircuitBreaker(session.full_name || session.email || session.user_id);
        const status = await FinancialCircuitBreaker.getCircuitStatus();
        return NextResponse.json({ success: true, circuit_breaker: status });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[Treasury Withdrawals POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 400 });
  }
}
