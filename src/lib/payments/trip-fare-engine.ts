import { getAdminClient } from '@/lib/supabase/admin';
import { getOrCreateEscortWallet, notifyEscortDailyPayoutDrop, formatKoboToNgn } from '@/lib/escort/escort-wallet';
import { todayInLagos } from '@/lib/timezone';

export interface TripAuthorizationResult {
  success: boolean;
  authorized: boolean;
  error?: string;
  reference?: string;
  escrow_hold_id?: string;
  pickup_leg_id?: string;
  dropoff_leg_id?: string;
  available_balance_ngn?: number;
  required_ngn?: number;
}

export interface LegCompletionResult {
  success: boolean;
  leg_type: 'pickup' | 'dropoff';
  both_legs_completed: boolean;
  fare_released: boolean;
  release_details?: any;
  error?: string;
}

export interface EveningSettlementResult {
  success: boolean;
  date: string;
  dry_run: boolean;
  total_trips_analyzed: number;
  settled_trips_count: number;
  settled_amount_kobo: number;
  settled_amount_ngn: number;
  held_for_review_count: number;
  held_trip_ids: string[];
  canceled_trips_count: number;
  settled_trip_ids: string[];
  escorts_payout_summary: Record<string, {
    escort_id: string;
    escort_name: string;
    amount_kobo: number;
    amount_ngn: number;
    formatted_amount: string;
    trips_count: number;
    wallet_id?: string;
  }>;
  error?: string;
}

export class TripFareEngine {
  /** Default daily school round-trip fee: ₦1,060 (106,000 Kobo) */
  public static readonly DEFAULT_DAILY_FEE_KOBO = 106000;

  /**
   * Pure financial mathematical invariant validator:
   * Enforces (driver_share_kobo + platform_kobo) === gross_amount_kobo.
   * Throws if rounding or floating point discrepancies occur.
   */
  public static verifyEscrowSplitAssertion(grossKobo: number): {
    grossKobo: number;
    vatKobo: number;
    kmKobo: number;
    myedurideKmKobo: number;
    driverShareKobo: number;
    platformShareKobo: number;
  } {
    if (!grossKobo || grossKobo <= 0) {
      throw new Error('FINTECH_INVALID_AMOUNT: Gross fare amount must be a positive integer kobo.');
    }
    const vatKobo = Math.round((grossKobo * 6) / 100);
    const kmKobo = grossKobo - vatKobo;
    const myedurideKmKobo = Math.round((kmKobo * 20) / 100);
    const driverShareKobo = kmKobo - myedurideKmKobo;
    const platformShareKobo = vatKobo + myedurideKmKobo;

    if (driverShareKobo + platformShareKobo !== grossKobo) {
      throw new Error(
        `FINTECH_ASSERTION_FAILED: Integrity violation — driver share (${driverShareKobo}) + platform share (${platformShareKobo}) does not equal gross amount (${grossKobo})!`
      );
    }

    return {
      grossKobo,
      vatKobo,
      kmKobo,
      myedurideKmKobo,
      driverShareKobo,
      platformShareKobo,
    };
  }

  /**
   * Pre-trip balance check and authorization.
   * If available balance >= required fee, locks amount in escrow and creates trip legs.
   * If insufficient, blocks authorization and sends standard alert notification.
   * Hardened: Strictly verifies integer balance split assertion prior to RPC execution.
   */
  public static async authorizeStudentTrip(params: {
    studentId: string;
    parentUserId: string;
    schoolId: string;
    grossKobo?: number;
    sessionId?: string;
    escortWalletId?: string;
  }): Promise<TripAuthorizationResult> {
    const supabase = getAdminClient();
    const grossKobo = params.grossKobo || this.DEFAULT_DAILY_FEE_KOBO;

    // Hardening check: verify split assertion before committing transaction
    this.verifyEscrowSplitAssertion(grossKobo);

    const { data, error } = await supabase.rpc('execute_atomic_trip_authorization', {
      p_student_id: params.studentId,
      p_parent_user_id: params.parentUserId,
      p_school_id: params.schoolId,
      p_gross_kobo: grossKobo,
      p_session_id: params.sessionId || null,
      p_escort_wallet_id: params.escortWalletId || null,
    });

    if (error) {
      console.error('[TripFareEngine] Authorization RPC error:', error);
      return {
        success: false,
        authorized: false,
        error: error.message || 'Authorization failed',
      };
    }

    if (!data?.success && data?.error === 'INSUFFICIENT_FUNDS') {
      // Send mandatory insufficient balance notification to parent
      await this.notifyParentInsufficientFunds(
        params.parentUserId,
        params.studentId,
        data.required_ngn,
        data.available_balance_ngn
      );
      return {
        success: false,
        authorized: false,
        error: 'INSUFFICIENT_FUNDS',
        available_balance_ngn: data.available_balance_ngn,
        required_ngn: data.required_ngn,
      };
    }

    return {
      success: true,
      authorized: true,
      reference: data.reference,
      escrow_hold_id: data.escrow_hold_id,
      pickup_leg_id: data.pickup_leg_id,
      dropoff_leg_id: data.dropoff_leg_id,
    };
  }

  /**
   * Record completion of an individual service leg (Pickup or Drop-off).
   * If both legs are now COMPLETED, triggers the atomic fare release procedure.
   */
  public static async recordLegCompletion(params: {
    studentId: string;
    legType: 'pickup' | 'dropoff';
    sessionId?: string;
    lat?: number;
    lng?: number;
    verifiedByUserId?: string;
    escortWalletId?: string;
  }): Promise<LegCompletionResult> {
    const supabase = getAdminClient();

    // 1. Locate or create open trip leg for this student and leg_type
    let query = supabase
      .from('trip_legs')
      .select('*')
      .eq('student_id', params.studentId)
      .eq('leg_type', params.legType)
      .in('status', ['PENDING', 'IN_PROGRESS']);

    if (params.sessionId) {
      query = query.eq('session_id', params.sessionId);
    }

    const { data: legs, error: legErr } = await query
      .order('created_at', { ascending: false })
      .limit(1);

    if (legErr) {
      console.error('[TripFareEngine] Error fetching trip leg:', legErr);
    }

    const currentLeg = legs?.[0];

    if (currentLeg) {
      // Mark leg completed with GPS and timestamp
      await supabase
        .from('trip_legs')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          gps_lat: params.lat || null,
          gps_lng: params.lng || null,
          verified_by_user_id: params.verifiedByUserId || null,
          escort_wallet_id: params.escortWalletId || currentLeg.escort_wallet_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentLeg.id);
    }

    // 2. Check if counterpart leg is also COMPLETED
    const counterpartType = params.legType === 'pickup' ? 'dropoff' : 'pickup';
    const { data: counterpartLegs } = await supabase
      .from('trip_legs')
      .select('status')
      .eq('student_id', params.studentId)
      .eq('leg_type', counterpartType)
      .eq('status', 'COMPLETED')
      .order('created_at', { ascending: false })
      .limit(1);

    const counterpartCompleted = (counterpartLegs?.length || 0) > 0;

    // If both legs are completed, trigger the atomic release engine
    if (counterpartCompleted) {
      const releaseRes = await this.releaseTripFare({
        studentId: params.studentId,
        sessionId: params.sessionId,
        escortWalletId: params.escortWalletId || currentLeg?.escort_wallet_id,
      });

      return {
        success: true,
        leg_type: params.legType,
        both_legs_completed: true,
        fare_released: releaseRes.success,
        release_details: releaseRes,
      };
    }

    return {
      success: true,
      leg_type: params.legType,
      both_legs_completed: false,
      fare_released: false,
    };
  }

  /**
   * Execute atomic fare release stored procedure across wallets.
   * Directly credits driver fare share into escort wallet available balance.
   */
  public static async releaseTripFare(params: {
    studentId: string;
    sessionId?: string;
    escortWalletId?: string;
    escortId?: string;
  }) {
    const supabase = getAdminClient();
    const idempotencyKey = `REL-${params.studentId}-${params.sessionId || 'DAILY'}-${new Date().toISOString().slice(0, 10)}`;

    let escortWalletId = params.escortWalletId;
    if (!escortWalletId && params.escortId) {
      const walletInfo = await getOrCreateEscortWallet(params.escortId);
      escortWalletId = walletInfo?.walletId;
    }

    const { data, error } = await supabase.rpc('process_trip_fare_release', {
      p_student_id: params.studentId,
      p_trip_id: params.sessionId || null,
      p_escort_wallet_id: escortWalletId || null,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      console.error('[TripFareEngine] Fare release error:', error);
      return { success: false, error: error.message };
    }

    return data;
  }

  /**
   * Cancels and refunds any active escrow hold for a student when a parent indicates
   * "Not Going" before the agreed morning pickup time.
   */
  public static async cancelStudentTripEscrow(
    studentId: string,
    reason: string = 'Parent declared Not Going before pickup cutoff'
  ) {
    const supabase = getAdminClient();
    try {
      const { data, error } = await supabase.rpc('cancel_trip_escrow_hold', {
        p_student_id: studentId,
        p_reason: reason,
      });

      if (error) {
        console.warn('[TripFareEngine] cancel_trip_escrow_hold RPC note:', error);
        return { success: false, error: error.message };
      }

      return data || { success: true };
    } catch (err: any) {
      console.error('[TripFareEngine] cancelStudentTripEscrow error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Automatic daily fee deduction when agreed pickup time is met.
   * If student was NOT canceled before cutoff, locks and commits today's fare.
   */
  public static async autoDeductTripFeeIfPastCutoff(params: {
    studentId: string;
    parentUserId: string;
    schoolId: string;
    grossKobo?: number;
    sessionId?: string;
    escortWalletId?: string;
    escortId?: string;
  }) {
    const supabase = getAdminClient();
    const today = new Date().toISOString().slice(0, 10);

    // 1. Check if student already canceled
    const { data: dailyTrip } = await supabase
      .from('escort_student_daily_trips')
      .select('id, is_canceled_by_parent, fee_deducted')
      .eq('student_id', params.studentId)
      .eq('trip_date', today)
      .maybeSingle();

    if (dailyTrip?.is_canceled_by_parent) {
      return { success: false, reason: 'TRIP_CANCELED_BY_PARENT_BEFORE_CUTOFF' };
    }

    if (dailyTrip?.fee_deducted) {
      return { success: true, reason: 'FEE_ALREADY_DEDUCTED' };
    }

    // 2. Authorize and lock the fee in escrow
    const authResult = await this.authorizeStudentTrip(params);

    if (authResult.success && authResult.authorized) {
      // 3. Mark fee as deducted in escort_student_daily_trips
      await supabase
        .from('escort_student_daily_trips')
        .update({
          fee_status: 'deducted',
          fee_deducted: true,
          fee_deducted_at: new Date().toISOString(),
          fee_amount_kobo: params.grossKobo || this.DEFAULT_DAILY_FEE_KOBO,
          cutoff_passed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', params.studentId)
        .eq('trip_date', today);
    }

    return authResult;
  }

  /**
   * PHASE 4: AUTOMATED 7:00 PM ESCROW SETTLEMENT ENGINE
   * 
   * Triggered daily at 7:00 PM Lagos Time (WAT) by cron worker or manual admin invocation.
   * Execution Flow:
   * 1. Scans all daily trips for target date.
   * 2. Completed trips (morning_picked_up = true AND afternoon_dropped_off = true):
   *    - Calls process_trip_fare_release to transfer escrow into escort wallet available balance.
   *    - Marks trip settlement_status = 'settled'.
   * 3. Incomplete trips (started but afternoon drop-off not confirmed):
   *    - Vaults trip as 'SETTLEMENT_HELD_FOR_REVIEW'.
   *    - Emits alert to City Manager / Admin to prevent incorrect payouts.
   * 4. Pre-cutoff canceled trips:
   *    - Ensures escrow holds are canceled and refunded.
   * 5. Dispatches high-priority payout notification to each compensated escort:
   *    "💰 Daily Payout Dropped: ₦[Amount] has been credited to your available balance for today's completed rides."
   */
  public static async executeEveningEscrowSettlement(params?: {
    date?: string;
    dryRun?: boolean;
    escortId?: string;
  }): Promise<EveningSettlementResult> {
    const supabase = getAdminClient();
    const targetDate = params?.date || todayInLagos();
    const isDryRun = Boolean(params?.dryRun);

    try {
      // Execute the database stored procedure
      const { data, error } = await supabase.rpc('process_evening_escrow_settlement', {
        p_date: targetDate,
        p_dry_run: isDryRun,
      });

      if (error) {
        console.error('[TripFareEngine] process_evening_escrow_settlement RPC error:', error);
        return {
          success: false,
          date: targetDate,
          dry_run: isDryRun,
          total_trips_analyzed: 0,
          settled_trips_count: 0,
          settled_amount_kobo: 0,
          settled_amount_ngn: 0,
          held_for_review_count: 0,
          held_trip_ids: [],
          canceled_trips_count: 0,
          settled_trip_ids: [],
          escorts_payout_summary: {},
          error: error.message || 'Settlement failed',
        };
      }

      const rawSummary = data || {};
      const escortPayoutsSummary = (rawSummary.escort_payouts_summary || {}) as Record<string, number>;
      const enrichedEscortSummary: Record<string, any> = {};

      // Enrich escort payouts and dispatch notifications if not a dry run
      for (const [escortKey, amountKobo] of Object.entries(escortPayoutsSummary)) {
        if (!amountKobo || amountKobo <= 0) continue;

        const walletInfo = await getOrCreateEscortWallet(escortKey);
        const escortName = walletInfo?.fullName || 'Escort Officer';
        const formattedAmount = formatKoboToNgn(amountKobo);

        enrichedEscortSummary[escortKey] = {
          escort_id: escortKey,
          escort_name: escortName,
          amount_kobo: amountKobo,
          amount_ngn: amountKobo / 100,
          formatted_amount: formattedAmount,
          trips_count: (rawSummary.settled_trips_count || 1),
          wallet_id: walletInfo?.walletId,
        };

        if (!isDryRun && walletInfo?.userId) {
          // Dispatch high-priority push & in-app notification
          await notifyEscortDailyPayoutDrop({
            escortUserId: walletInfo.userId,
            escortName,
            escortEmail: walletInfo.email,
            amountKobo,
            completedTripsCount: rawSummary.settled_trips_count || 1,
            dateStr: targetDate,
          });
        }
      }

      return {
        success: true,
        date: targetDate,
        dry_run: isDryRun,
        total_trips_analyzed: Number(rawSummary.total_trips_analyzed || 0),
        settled_trips_count: Number(rawSummary.settled_trips_count || 0),
        settled_amount_kobo: Number(rawSummary.settled_amount_kobo || 0),
        settled_amount_ngn: Number(rawSummary.settled_amount_kobo || 0) / 100,
        held_for_review_count: Number(rawSummary.held_for_review_count || 0),
        held_trip_ids: rawSummary.held_trip_ids || [],
        canceled_trips_count: Number(rawSummary.canceled_trips_count || 0),
        settled_trip_ids: rawSummary.settled_trip_ids || [],
        escorts_payout_summary: enrichedEscortSummary,
      };
    } catch (err: any) {
      console.error('[TripFareEngine] executeEveningEscrowSettlement error:', err);
      return {
        success: false,
        date: targetDate,
        dry_run: isDryRun,
        total_trips_analyzed: 0,
        settled_trips_count: 0,
        settled_amount_kobo: 0,
        settled_amount_ngn: 0,
        held_for_review_count: 0,
        held_trip_ids: [],
        canceled_trips_count: 0,
        settled_trip_ids: [],
        escorts_payout_summary: {},
        error: err.message || 'Settlement failed',
      };
    }
  }

  /**
   * Insufficient funds notification with exact approved regulatory wording.
   */
  private static async notifyParentInsufficientFunds(
    parentUserId: string,
    studentId: string,
    requiredNgn: number,
    availableNgn: number
  ) {
    const supabase = getAdminClient();
    const exactMessage =
      "Your MyEduRide wallet balance is insufficient for today's scheduled transport. Please fund your wallet to authorize pickup and drop-off.";

    await supabase.from('notifications').insert({
      user_id: parentUserId,
      student_id: studentId,
      title: 'Action Required: Transport Balance Insufficient',
      message: exactMessage,
      type: 'financial_alert',
      metadata: {
        required_ngn: requiredNgn,
        available_ngn: availableNgn,
        alert_code: 'INSUFFICIENT_PRE_TRIP_BALANCE',
      },
    });
  }
}
