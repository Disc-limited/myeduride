import { getAdminClient } from '@/lib/supabase/admin';

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

export class TripFareEngine {
  /** Default daily school round-trip fee: ₦1,060 (106,000 Kobo) */
  public static readonly DEFAULT_DAILY_FEE_KOBO = 106000;

  /**
   * Pre-trip balance check and authorization.
   * If available balance >= required fee, locks amount in escrow and creates trip legs.
   * If insufficient, blocks authorization and sends standard alert notification.
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
      await this.notifyParentInsufficientFunds(params.parentUserId, params.studentId, data.required_ngn, data.available_balance_ngn);
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

    // 2. Check if the counterpart leg is also COMPLETED
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
   */
  public static async releaseTripFare(params: {
    studentId: string;
    sessionId?: string;
    escortWalletId?: string;
  }) {
    const supabase = getAdminClient();
    const idempotencyKey = `REL-${params.studentId}-${params.sessionId || 'DAILY'}-${new Date().toISOString().slice(0, 10)}`;

    const { data, error } = await supabase.rpc('process_trip_fare_release', {
      p_student_id: params.studentId,
      p_trip_id: params.sessionId || null,
      p_escort_wallet_id: params.escortWalletId || null,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      console.error('[TripFareEngine] Fare release error:', error);
      return { success: false, error: error.message };
    }

    return data;
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
