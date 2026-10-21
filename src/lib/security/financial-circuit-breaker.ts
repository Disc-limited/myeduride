/**
 * FINANCIAL CIRCUIT BREAKER & VELOCITY LIMITS (PHASE 6.4)
 * 
 * Enforces automated treasury safety constraints:
 * 1. Single Parent Deposit Ceiling: ₦500,000.00 (50,000,000 kobo).
 * 2. Platform Hourly Outflow Ceiling: ₦3,000,000.00 (300,000,000 kobo).
 * 3. Automated Kill-Switch: Pauses all outbound payouts if velocity limits are exceeded
 *    or if a cryptographic hash chain mismatch is detected.
 */

import { getAdminClient } from '@/lib/supabase/admin';

export const TREASURY_VELOCITY_LIMITS = {
  MAX_SINGLE_PARENT_DEPOSIT_KOBO: 50000000,   // ₦500,000.00
  MAX_HOURLY_PAYOUT_OUTFLOW_KOBO: 300000000,  // ₦3,000,000.00
  CIRCUIT_ID: 'MAIN_TREASURY_CIRCUIT',
};

// In-memory sliding window cache for fast checks
interface OutflowEntry {
  timestamp: number;
  amountKobo: number;
}
const recentOutflows: OutflowEntry[] = [];

export class FinancialCircuitBreaker {
  /**
   * Asserts that a single parent deposit does not exceed the velocity limit (₦500,000).
   */
  public static assertParentDepositPermitted(depositAmountKobo: number): void {
    if (!depositAmountKobo || isNaN(depositAmountKobo) || depositAmountKobo <= 0) {
      throw new Error('Deposit amount must be a positive integer in kobo');
    }

    if (depositAmountKobo > TREASURY_VELOCITY_LIMITS.MAX_SINGLE_PARENT_DEPOSIT_KOBO) {
      const maxNgn = (TREASURY_VELOCITY_LIMITS.MAX_SINGLE_PARENT_DEPOSIT_KOBO / 100).toLocaleString('en-NG', {
        minimumFractionDigits: 2,
      });
      const requestedNgn = (depositAmountKobo / 100).toLocaleString('en-NG', {
        minimumFractionDigits: 2,
      });
      throw new Error(
        `DEPOSIT_VELOCITY_LIMIT_EXCEEDED: Maximum single deposit limit of ₦${maxNgn} exceeded (requested ₦${requestedNgn})`
      );
    }
  }

  /**
   * Calculates the total platform outbound payouts processed within the last 60 minutes.
   */
  public static async getHourlyOutflowKobo(): Promise<number> {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const oneHourAgoIso = new Date(oneHourAgo).toISOString();

    // 1. Clean in-memory entries older than 60 minutes
    while (recentOutflows.length > 0 && recentOutflows[0].timestamp < oneHourAgo) {
      recentOutflows.shift();
    }
    const memTotal = recentOutflows.reduce((sum, item) => sum + item.amountKobo, 0);

    // 2. Query recent DB ledger transactions for reconciliation
    try {
      const supabase = getAdminClient();
      const { data: dbRows } = await supabase
        .from('wallet_transactions')
        .select('amount_kobo')
        .eq('transaction_type', 'DEBIT')
        .in('channel', ['BANK_PAYOUT', 'WITHDRAWAL_PAYOUT'])
        .gte('created_at', oneHourAgoIso);

      if (dbRows && dbRows.length > 0) {
        const dbTotal = dbRows.reduce((sum, r) => sum + Number(r.amount_kobo), 0);
        return Math.max(memTotal, dbTotal);
      }
    } catch (err) {
      console.warn('[CircuitBreaker] DB outflow query note:', err);
    }

    return memTotal;
  }

  /**
   * Asserts that an outbound payout is permitted:
   * 1. Circuit breaker must NOT be paused.
   * 2. (Current 60-minute outflow + candidate payout) must NOT exceed ₦3,000,000.
   */
  public static async assertOutboundPayoutPermitted(candidateAmountKobo: number): Promise<void> {
    const supabase = getAdminClient();

    // 1. Check circuit breaker status
    const { data: circuit } = await supabase
      .from('treasury_circuit_breaker')
      .select('is_paused, paused_reason')
      .eq('id', TREASURY_VELOCITY_LIMITS.CIRCUIT_ID)
      .maybeSingle();

    if (circuit?.is_paused) {
      throw new Error(
        `TREASURY_CIRCUIT_BREAKER_ACTIVE: Outbound payouts are temporarily paused. Reason: ${circuit.paused_reason || 'Safety hold'}`
      );
    }

    // 2. Velocity limit calculation
    const currentHourlyOutflow = await this.getHourlyOutflowKobo();
    const projectedOutflow = currentHourlyOutflow + candidateAmountKobo;

    if (projectedOutflow > TREASURY_VELOCITY_LIMITS.MAX_HOURLY_PAYOUT_OUTFLOW_KOBO) {
      // Auto-trip the circuit breaker
      const currentNgn = (currentHourlyOutflow / 100).toLocaleString('en-NG');
      const candidateNgn = (candidateAmountKobo / 100).toLocaleString('en-NG');
      const limitNgn = (TREASURY_VELOCITY_LIMITS.MAX_HOURLY_PAYOUT_OUTFLOW_KOBO / 100).toLocaleString('en-NG');

      const reason = `Automated kill-switch: Hourly payout limit of ₦${limitNgn} exceeded (current ₦${currentNgn} + candidate ₦${candidateNgn})`;
      await this.tripCircuitBreaker(reason, 'AUTOMATED_VELOCITY_SENTINEL');

      throw new Error(
        `HOURLY_OUTFLOW_VELOCITY_LIMIT_EXCEEDED: ${reason}`
      );
    }
  }

  /**
   * Records a successfully executed outbound payout in the velocity tracker.
   */
  public static async recordOutboundPayout(amountKobo: number): Promise<void> {
    recentOutflows.push({
      timestamp: Date.now(),
      amountKobo,
    });
  }

  /**
   * Trips the circuit breaker, immediately freezing all outbound bank transfers.
   */
  public static async tripCircuitBreaker(reason: string, triggeredBy = 'SYSTEM'): Promise<void> {
    const supabase = getAdminClient();
    const nowIso = new Date().toISOString();

    console.warn(`🚨 [CircuitBreaker] TRIPPING TREASURY KILL-SWITCH: ${reason} (by ${triggeredBy})`);

    await supabase
      .from('treasury_circuit_breaker')
      .upsert({
        id: TREASURY_VELOCITY_LIMITS.CIRCUIT_ID,
        is_paused: true,
        paused_reason: reason,
        paused_at: nowIso,
        paused_by: triggeredBy,
        updated_at: nowIso,
      });
  }

  /**
   * Resets the circuit breaker. Requires SuperAdmin authorization.
   */
  public static async resetCircuitBreaker(authorizedBy: string): Promise<void> {
    const supabase = getAdminClient();
    const nowIso = new Date().toISOString();

    console.log(`✅ [CircuitBreaker] Resetting treasury circuit breaker (authorized by: ${authorizedBy})`);

    // Clear in-memory accumulator
    recentOutflows.length = 0;

    await supabase
      .from('treasury_circuit_breaker')
      .update({
        is_paused: false,
        paused_reason: null,
        paused_at: null,
        paused_by: null,
        last_reset_at: nowIso,
        last_reset_by: authorizedBy,
        updated_at: nowIso,
      })
      .eq('id', TREASURY_VELOCITY_LIMITS.CIRCUIT_ID);
  }

  /**
   * Audits the cryptographic hash chain for a specific wallet or across all wallets.
   * If any tampering or hash mismatch is detected, trips the circuit breaker immediately.
   */
  public static async auditLedgerAndTripOnMismatch(walletId?: string): Promise<{
    healthy: boolean;
    totalAudited: number;
    brokenWallets: Array<{
      walletId: string;
      brokenAtId?: string;
      message: string;
    }>;
  }> {
    const supabase = getAdminClient();
    const { data: auditRows, error: auditErr } = await supabase.rpc('verify_ledger_chain', {
      p_wallet_id: walletId || null,
    });

    if (auditErr) {
      console.error('[CircuitBreaker] verify_ledger_chain RPC failed:', auditErr);
      throw new Error(`Failed to audit ledger chain: ${auditErr.message}`);
    }

    const rows = auditRows || [];
    const broken = rows.filter((r: any) => !r.is_valid);

    if (broken.length > 0) {
      const brokenIds = broken.map((b: any) => b.wallet_id).join(', ');
      const reason = `CRITICAL LEDGER COMPROMISE: Tamper-evident hash chain mismatch detected in wallet(s): ${brokenIds}`;
      await this.tripCircuitBreaker(reason, 'LEDGER_INTEGRITY_AUDITOR');

      return {
        healthy: false,
        totalAudited: rows.length,
        brokenWallets: broken.map((b: any) => ({
          walletId: b.wallet_id,
          brokenAtId: b.broken_at_id,
          message: b.message,
        })),
      };
    }

    return {
      healthy: true,
      totalAudited: rows.length,
      brokenWallets: [],
    };
  }

  /**
   * Returns live circuit breaker status.
   */
  public static async getCircuitStatus(): Promise<{
    isPaused: boolean;
    pausedReason?: string;
    pausedAt?: string;
    pausedBy?: string;
    hourlyOutflowKobo: number;
    hourlyOutflowNgn: number;
    maxHourlyOutflowNgn: number;
    maxDepositNgn: number;
  }> {
    const supabase = getAdminClient();
    const { data: circuit } = await supabase
      .from('treasury_circuit_breaker')
      .select('*')
      .eq('id', TREASURY_VELOCITY_LIMITS.CIRCUIT_ID)
      .maybeSingle();

    const hourlyOutflowKobo = await this.getHourlyOutflowKobo();

    return {
      isPaused: circuit?.is_paused ?? false,
      pausedReason: circuit?.paused_reason || undefined,
      pausedAt: circuit?.paused_at || undefined,
      pausedBy: circuit?.paused_by || undefined,
      hourlyOutflowKobo,
      hourlyOutflowNgn: hourlyOutflowKobo / 100,
      maxHourlyOutflowNgn: TREASURY_VELOCITY_LIMITS.MAX_HOURLY_PAYOUT_OUTFLOW_KOBO / 100,
      maxDepositNgn: TREASURY_VELOCITY_LIMITS.MAX_SINGLE_PARENT_DEPOSIT_KOBO / 100,
    };
  }
}
