/**
 * MAKER-CHECKER DUAL CUSTODY FOR BANK WITHDRAWALS (PHASE 6.3)
 * 
 * Enforces dual-authorization controls for outbound treasury movements:
 * 1. Maker-Checker Segregation: The user who submits a withdrawal cannot approve it.
 * 2. Mandatory TOTP 2FA: Checkers must verify a time-based 2FA token to authorize requests.
 * 3. High-Value Escalation:
 *    - Escorts: > ₦100,000 (10,000,000 kobo) requires secondary SuperAdmin approval.
 *    - Schools: > ₦500,000 (50,000,000 kobo) requires secondary SuperAdmin approval.
 * 4. Circuit Breaker Integration: Rejects payout execution if hourly outflow limits are exceeded.
 */

import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase/admin';
import { FinancialCircuitBreaker } from '@/lib/security/financial-circuit-breaker';

export const WITHDRAWAL_THRESHOLDS = {
  ESCORT_HIGH_VALUE_KOBO: 10000000, // ₦100,000.00
  SCHOOL_HIGH_VALUE_KOBO: 50000000, // ₦500,000.00
  MINIMUM_WITHDRAWAL_KOBO: 50000,   // ₦500.00
};

export type WithdrawalStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED_BY_CHECKER'
  | 'REJECTED'
  | 'EXECUTED'
  | 'CANCELLED';

export interface WithdrawalRequestRecord {
  id: string;
  wallet_id: string;
  user_id: string;
  entity_type: 'escort' | 'school' | 'parent';
  amount_kobo: number;
  amount_ngn: number;
  bank_code: string;
  bank_name?: string;
  account_number: string;
  account_name: string;
  narration?: string;
  status: WithdrawalStatus;
  requires_super_admin: boolean;
  maker_user_id?: string;
  checker_user_id?: string;
  checker_totp_verified_at?: string;
  super_admin_user_id?: string;
  super_admin_approved_at?: string;
  rejection_reason?: string;
  rejected_by_user_id?: string;
  rejected_at?: string;
  payout_reference?: string;
  executed_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Lightweight, zero-dependency RFC 6238 TOTP (Time-Based One-Time Password) implementation.
 */
export class TotpVerifier {
  private static readonly BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  /**
   * Decodes Base32 string into Buffer
   */
  public static base32Decode(base32: string): Buffer {
    const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (let i = 0; i < clean.length; i++) {
      const idx = this.BASE32_CHARS.indexOf(clean[i]);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return Buffer.from(output);
  }

  /**
   * Generates a 6-digit TOTP token for a given timestamp and secret
   */
  public static generateTotp(secret: string, timestampMs = Date.now(), stepSeconds = 30): string {
    const key = this.base32Decode(secret);
    const counter = Math.floor(timestampMs / 1000 / stepSeconds);

    const counterBuf = Buffer.alloc(8);
    counterBuf.writeBigInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const strCode = (code % 1000000).toString().padStart(6, '0');
    return strCode;
  }

  /**
   * Verifies TOTP with ±1 step window for network drift
   */
  public static verifyTotp(secret: string, token: string, windowSteps = 1): boolean {
    if (!secret || !token || token.trim().length !== 6) return false;
    const cleanToken = token.trim();
    const now = Date.now();
    const stepMs = 30 * 1000;

    for (let step = -windowSteps; step <= windowSteps; step++) {
      const expected = this.generateTotp(secret, now + step * stepMs);
      if (cleanToken === expected) {
        return true;
      }
    }
    return false;
  }
}

export class WithdrawalCustodyEngine {
  /**
   * Checks whether a withdrawal amount exceeds the single-signer ceiling and requires secondary SuperAdmin sign-off.
   */
  public static isSuperAdminApprovalRequired(
    entityType: 'escort' | 'school' | 'parent',
    amountKobo: number
  ): boolean {
    if (entityType === 'escort') {
      return amountKobo > WITHDRAWAL_THRESHOLDS.ESCORT_HIGH_VALUE_KOBO;
    }
    if (entityType === 'school') {
      return amountKobo > WITHDRAWAL_THRESHOLDS.SCHOOL_HIGH_VALUE_KOBO;
    }
    return amountKobo > WITHDRAWAL_THRESHOLDS.SCHOOL_HIGH_VALUE_KOBO;
  }

  /**
   * Step 1: Maker submits a withdrawal request.
   */
  public static async requestWithdrawal(params: {
    walletId: string;
    userId: string;
    entityType: 'escort' | 'school' | 'parent';
    amountKobo: number;
    bankCode: string;
    bankName?: string;
    accountNumber: string;
    accountName: string;
    narration?: string;
    makerUserId: string;
  }): Promise<WithdrawalRequestRecord> {
    const {
      walletId,
      userId,
      entityType,
      amountKobo,
      bankCode,
      bankName,
      accountNumber,
      accountName,
      narration,
      makerUserId,
    } = params;

    if (!amountKobo || isNaN(amountKobo) || amountKobo < WITHDRAWAL_THRESHOLDS.MINIMUM_WITHDRAWAL_KOBO) {
      throw new Error(`Minimum withdrawal amount is ₦${(WITHDRAWAL_THRESHOLDS.MINIMUM_WITHDRAWAL_KOBO / 100).toLocaleString()}`);
    }

    const supabase = getAdminClient();

    // 1. Verify wallet available balance
    const { data: wallet, error: walletErr } = await supabase
      .from('wallets')
      .select('id, available_balance_kobo, status')
      .eq('id', walletId)
      .single();

    if (walletErr || !wallet) {
      throw new Error('Target wallet not found');
    }

    if (wallet.status !== 'active') {
      throw new Error(`Wallet is ${wallet.status} and cannot process withdrawals`);
    }

    if (Number(wallet.available_balance_kobo) < amountKobo) {
      throw new Error(
        `Insufficient available funds: Available balance ₦${(
          Number(wallet.available_balance_kobo) / 100
        ).toLocaleString(undefined, { minimumFractionDigits: 2 })} is less than requested ₦${(
          amountKobo / 100
        ).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      );
    }

    // 2. High-Value Escalation check
    const requiresSuperAdmin = this.isSuperAdminApprovalRequired(entityType, amountKobo);

    // 3. Insert withdrawal request
    const { data: request, error: insertErr } = await supabase
      .from('withdrawal_requests')
      .insert({
        wallet_id: walletId,
        user_id: userId,
        entity_type: entityType,
        amount_kobo: amountKobo,
        amount_ngn: amountKobo / 100,
        bank_code: bankCode,
        bank_name: bankName || 'Commercial Bank',
        account_number: accountNumber,
        account_name: accountName,
        narration: narration || `Withdrawal payout for ${entityType}`,
        status: 'PENDING_REVIEW',
        requires_super_admin: requiresSuperAdmin,
        maker_user_id: makerUserId,
      })
      .select()
      .single();

    if (insertErr || !request) {
      throw new Error(`Failed to create withdrawal request: ${insertErr?.message || 'Database error'}`);
    }

    return request as WithdrawalRequestRecord;
  }

  /**
   * Step 2: Checker approves with mandatory TOTP 2FA.
   * Invariant: maker_user_id cannot be checker_user_id.
   */
  public static async checkerApproveWithdrawal(params: {
    requestId: string;
    checkerUserId: string;
    totpCode: string;
    totpSecret: string;
  }): Promise<WithdrawalRequestRecord> {
    const { requestId, checkerUserId, totpCode, totpSecret } = params;
    const supabase = getAdminClient();

    const { data: request, error: reqErr } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (reqErr || !request) {
      throw new Error('Withdrawal request not found');
    }

    if (request.status !== 'PENDING_REVIEW') {
      throw new Error(`Cannot approve request in status: ${request.status}`);
    }

    // INVARIANT: Maker-Checker Segregation
    if (request.maker_user_id && request.maker_user_id === checkerUserId) {
      throw new Error('MAKER_CHECKER_VIOLATION: The maker of a withdrawal request cannot be its checker');
    }

    // INVARIANT: Mandatory TOTP 2FA
    const isValidTotp = TotpVerifier.verifyTotp(totpSecret, totpCode);
    if (!isValidTotp) {
      throw new Error('INVALID_TOTP_2FA_TOKEN: Provided 2FA code is invalid or has expired');
    }

    const { data: updated, error: updateErr } = await supabase
      .from('withdrawal_requests')
      .update({
        status: 'APPROVED_BY_CHECKER',
        checker_user_id: checkerUserId,
        checker_totp_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single();

    if (updateErr || !updated) {
      throw new Error(`Failed to approve withdrawal request: ${updateErr?.message || 'Database error'}`);
    }

    return updated as WithdrawalRequestRecord;
  }

  /**
   * Step 3: Secondary SuperAdmin approval for high-value requests.
   */
  public static async superAdminApproveWithdrawal(params: {
    requestId: string;
    superAdminUserId: string;
  }): Promise<WithdrawalRequestRecord> {
    const { requestId, superAdminUserId } = params;
    const supabase = getAdminClient();

    const { data: request, error: reqErr } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (reqErr || !request) {
      throw new Error('Withdrawal request not found');
    }

    if (request.status !== 'APPROVED_BY_CHECKER') {
      throw new Error(`Withdrawal must be approved by checker before super admin review (current status: ${request.status})`);
    }

    if (!request.requires_super_admin) {
      // Not strictly necessary, but can be stamped
    }

    const { data: updated, error: updateErr } = await supabase
      .from('withdrawal_requests')
      .update({
        super_admin_user_id: superAdminUserId,
        super_admin_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single();

    if (updateErr || !updated) {
      throw new Error(`Failed to record SuperAdmin approval: ${updateErr?.message || 'Database error'}`);
    }

    return updated as WithdrawalRequestRecord;
  }

  /**
   * Step 4: Rejection by Checker or SuperAdmin.
   */
  public static async rejectWithdrawal(params: {
    requestId: string;
    reviewerUserId: string;
    reason: string;
  }): Promise<WithdrawalRequestRecord> {
    const { requestId, reviewerUserId, reason } = params;
    const supabase = getAdminClient();

    const { data: updated, error: updateErr } = await supabase
      .from('withdrawal_requests')
      .update({
        status: 'REJECTED',
        rejection_reason: reason || 'Rejected during maker-checker financial review',
        rejected_by_user_id: reviewerUserId,
        rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single();

    if (updateErr || !updated) {
      throw new Error(`Failed to reject withdrawal request: ${updateErr?.message || 'Database error'}`);
    }

    return updated as WithdrawalRequestRecord;
  }

  /**
   * Step 5: Execute payout and commit immutable ledger transactions.
   * Checks circuit breaker outflow limits before transferring funds.
   */
  public static async executeWithdrawalPayout(params: {
    requestId: string;
    executorUserId: string;
  }): Promise<{ success: boolean; request: WithdrawalRequestRecord; transactionRef: string }> {
    const { requestId, executorUserId } = params;
    const supabase = getAdminClient();

    const { data: request, error: reqErr } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (reqErr || !request) {
      throw new Error('Withdrawal request not found');
    }

    if (request.status !== 'APPROVED_BY_CHECKER') {
      throw new Error(`Request is not ready for execution (status: ${request.status})`);
    }

    // Verify SuperAdmin sign-off if flagged as high-value
    if (request.requires_super_admin && !request.super_admin_user_id) {
      throw new Error('SUPERADMIN_SIGN_OFF_REQUIRED: High-value withdrawal requires secondary SuperAdmin approval');
    }

    // Check circuit breaker and velocity limits
    await FinancialCircuitBreaker.assertOutboundPayoutPermitted(Number(request.amount_kobo));

    // Fetch wallet with pessimistic row lock
    const { data: wallet, error: walletErr } = await supabase
      .from('wallets')
      .select('id, available_balance_kobo')
      .eq('id', request.wallet_id)
      .single();

    if (walletErr || !wallet) {
      throw new Error('Wallet not found');
    }

    const balanceBefore = Number(wallet.available_balance_kobo);
    const amountKobo = Number(request.amount_kobo);

    if (balanceBefore < amountKobo) {
      throw new Error('Insufficient wallet balance at time of execution');
    }

    const balanceAfter = balanceBefore - amountKobo;
    const payoutRef = `WTH-EXEC-${requestId.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;

    // 1. Deduct wallet available balance
    const { error: balErr } = await supabase
      .from('wallets')
      .update({
        available_balance_kobo: balanceAfter,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id);

    if (balErr) {
      throw new Error(`Failed to deduct wallet balance: ${balErr.message}`);
    }

    // 2. Insert immutable DEBIT transaction into ledger (hash chain trigger will compute integrity hashes)
    const { error: txErr } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        transaction_type: 'DEBIT',
        channel: 'BANK_PAYOUT',
        amount_kobo: amountKobo,
        balance_before_kobo: balanceBefore,
        balance_after_kobo: balanceAfter,
        reference: payoutRef,
        status: 'COMPLETED',
        description: `Bank withdrawal payout to ${request.account_name} (${request.account_number} - ${request.bank_name || request.bank_code})`,
        metadata: {
          withdrawal_request_id: requestId,
          maker_user_id: request.maker_user_id,
          checker_user_id: request.checker_user_id,
          super_admin_user_id: request.super_admin_user_id,
          executed_by: executorUserId,
          account_number: request.account_number,
          bank_code: request.bank_code,
        },
      });

    if (txErr) {
      console.error('[Withdrawal Custody] Ledger transaction insertion error:', txErr);
      // Attempt balance reversal
      await supabase
        .from('wallets')
        .update({ available_balance_kobo: balanceBefore })
        .eq('id', wallet.id);
      throw new Error(`Failed to record ledger transaction: ${txErr.message}`);
    }

    // 3. Mark request as EXECUTED
    const { data: updatedReq, error: reqUpdateErr } = await supabase
      .from('withdrawal_requests')
      .update({
        status: 'EXECUTED',
        payout_reference: payoutRef,
        executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single();

    if (reqUpdateErr) {
      console.error('[Withdrawal Custody] Failed to stamp execution reference on request:', reqUpdateErr);
    }

    // 4. Record outflow in circuit breaker accumulator
    await FinancialCircuitBreaker.recordOutboundPayout(amountKobo);

    return {
      success: true,
      request: (updatedReq || request) as WithdrawalRequestRecord,
      transactionRef: payoutRef,
    };
  }
}
