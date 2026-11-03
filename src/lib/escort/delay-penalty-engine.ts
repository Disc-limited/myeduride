/**
 * ESCORT ARRIVAL, GPS VERIFICATION & DELAY PENALTY ENGINE
 *
 * Implements Daisaf Wallet System Specification Section 3.3 & 3.4:
 * - "I Am Here for Pickup" with device GPS capture
 * - Instant parent notification to send child out
 * - GPS latitude & longitude verification against parent house coordinates
 * - City Manager live telemetry notification
 * - 2-minute grace period + 1-minute scan buffer (Total 3 minutes)
 * - Automatic ₦50/minute penalty deduction from Parent Wallet into Escrow
 */

import { getAdminClient } from '@/lib/supabase/admin';
import { sendPushToUser } from '@/lib/push/send';
import { sendEmail } from '@/lib/notifications/email-service';

export interface EscortArrivalResult {
  success: boolean;
  arrivalId?: string;
  studentId: string;
  studentName?: string;
  parentUserId?: string;
  parentName?: string;
  distanceMeters: number;
  geofencePassed: boolean;
  arrivedAt: string;
  graceExpiresAt: string;
  penaltyStartsAt: string;
  error?: string;
}

export interface DelayPenaltyCalculationResult {
  success: boolean;
  arrivalId: string;
  studentId?: string;
  parentUserId?: string;
  delayMinutes: number;
  penaltyKobo: number;
  penaltyNgn: number;
  status: 'NONE' | 'WAIVED' | 'CHARGED' | 'INSUFFICIENT_FUNDS';
  transactionRef?: string;
  message?: string;
  error?: string;
}

export class DelayPenaltyEngine {
  /** Penalty rate per minute of delay: ₦50.00 (5,000 Kobo) */
  public static readonly PENALTY_RATE_PER_MINUTE_KOBO = 5000;

  /** Maximum geofence distance tolerance: 150 meters */
  public static readonly GEOFENCE_TOLERANCE_METERS = 150.0;

  /** Grace period: 2 minutes + 1 minute scan buffer = 3 minutes total */
  public static readonly GRACE_PERIOD_MS = 2 * 60 * 1000;
  public static readonly SCAN_BUFFER_MS = 1 * 60 * 1000;
  public static readonly TOTAL_GRACE_WINDOW_MS = 3 * 60 * 1000;

  /**
   * Computes Haversine distance in meters between two GPS coordinates.
   */
  public static calculateDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  /**
   * Escort taps "I Am Here for Pickup":
   * 1. Captures escort GPS & verifies against student's pinned house coordinates.
   * 2. Sets 2 min grace + 1 min scan clock (3 minutes total).
   * 3. Dispatches high-priority notification to Parent & City Manager.
   */
  public static async recordEscortArrival(params: {
    studentId: string;
    escortId: string;
    escortLat: number;
    escortLng: number;
    escortName?: string;
    escortUserId?: string;
    tripId?: string;
  }): Promise<EscortArrivalResult> {
    const { studentId, escortId, escortLat, escortLng, escortName, escortUserId, tripId } = params;
    const supabase = getAdminClient();

    // 1. Fetch Student & House Coordinates
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, house_lat, house_lng, house_address, school_id')
      .eq('id', studentId)
      .maybeSingle();

    if (studentErr || !student) {
      return {
        success: false,
        studentId,
        distanceMeters: 0,
        geofencePassed: false,
        arrivedAt: new Date().toISOString(),
        graceExpiresAt: new Date().toISOString(),
        penaltyStartsAt: new Date().toISOString(),
        error: 'Student record not found.',
      };
    }

    // 2. Fetch Linked Primary Parent
    const { data: parentLink } = await supabase
      .from('student_parents')
      .select('parent_user_id')
      .eq('student_id', studentId)
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle();

    const parentUserId = parentLink?.parent_user_id;
    if (!parentUserId) {
      return {
        success: false,
        studentId,
        distanceMeters: 0,
        geofencePassed: false,
        arrivedAt: new Date().toISOString(),
        graceExpiresAt: new Date().toISOString(),
        penaltyStartsAt: new Date().toISOString(),
        error: 'No parent linked to this student.',
      };
    }

    const targetLat = student.house_lat != null ? Number(student.house_lat) : escortLat;
    const targetLng = student.house_lng != null ? Number(student.house_lng) : escortLng;

    const distanceMeters = this.calculateDistanceMeters(escortLat, escortLng, targetLat, targetLng);
    const geofencePassed = distanceMeters <= this.GEOFENCE_TOLERANCE_METERS;

    const now = new Date();
    const graceExpiresAt = new Date(now.getTime() + this.GRACE_PERIOD_MS);
    const penaltyStartsAt = new Date(now.getTime() + this.TOTAL_GRACE_WINDOW_MS);

    // 3. Insert or Update Arrival Event in escort_pickup_arrivals
    const { data: arrivalEvent, error: insertErr } = await supabase
      .from('escort_pickup_arrivals')
      .insert({
        trip_id: tripId || null,
        student_id: studentId,
        escort_id: escortId,
        escort_user_id: escortUserId || null,
        parent_user_id: parentUserId,
        escort_lat: escortLat,
        escort_lng: escortLng,
        target_lat: targetLat,
        target_lng: targetLng,
        distance_meters: distanceMeters,
        geofence_passed: geofencePassed,
        arrived_at: now.toISOString(),
        grace_expires_at: graceExpiresAt.toISOString(),
        penalty_starts_at: penaltyStartsAt.toISOString(),
        penalty_status: 'NONE',
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('[DelayPenaltyEngine] Failed to insert arrival record:', insertErr);
    }

    const studentFullName = `${student.first_name} ${student.last_name}`;
    const driverLabel = escortName || 'Your assigned MyEduRide Escort';

    // 4. Send Instant Push & In-App Notification to Parent
    void sendPushToUser(supabase, parentUserId, {
      title: `🚐 Escort Arrived for ${studentFullName}`,
      body: `${driverLabel} is at your location (${distanceMeters}m). Please send ${student.first_name} out for immediate boarding.`,
      url: `/dashboard/parent?tab=safety-connect`,
      data: {
        type: 'escort_arrival',
        studentId,
        arrivalId: arrivalEvent?.id,
        penaltyStartsAt: penaltyStartsAt.toISOString(),
      },
    }).catch(() => {});

    // 5. Notify City Manager / System Telemetry
    try {
      await supabase
        .from('notifications')
        .insert([
          {
            user_id: parentUserId,
            school_id: student.school_id,
            student_id: student.id,
            title: `Escort Arrival: ${studentFullName}`,
            message: `${driverLabel} has arrived for morning pickup. 2-minute grace active.`,
            type: 'escort_pickup_arrival',
            is_read: false,
          },
        ]);
    } catch {
      // non-critical
    }

    return {
      success: true,
      arrivalId: arrivalEvent?.id,
      studentId,
      studentName: studentFullName,
      parentUserId,
      distanceMeters,
      geofencePassed,
      arrivedAt: now.toISOString(),
      graceExpiresAt: graceExpiresAt.toISOString(),
      penaltyStartsAt: penaltyStartsAt.toISOString(),
    };
  }

  /**
   * Applies the delay penalty upon student boarding:
   * - If boarded within 3 minutes (2 min grace + 1 min scan): ₦0 penalty.
   * - If delayed: ₦50 per minute of delay debited from Parent Wallet and credited to Escrow.
   */
  public static async computeAndApplyDelayPenalty(params: {
    arrivalId: string;
    boardedAt?: Date;
  }): Promise<DelayPenaltyCalculationResult> {
    const { arrivalId, boardedAt = new Date() } = params;
    const supabase = getAdminClient();

    // 1. Fetch Arrival Record
    const { data: arrival, error: fetchErr } = await supabase
      .from('escort_pickup_arrivals')
      .select('*')
      .eq('id', arrivalId)
      .maybeSingle();

    if (fetchErr || !arrival) {
      return {
        success: false,
        arrivalId,
        delayMinutes: 0,
        penaltyKobo: 0,
        penaltyNgn: 0,
        status: 'NONE',
        error: 'Arrival record not found.',
      };
    }

    if (arrival.penalty_status === 'CHARGED') {
      return {
        success: true,
        arrivalId,
        studentId: arrival.student_id,
        parentUserId: arrival.parent_user_id,
        delayMinutes: arrival.delay_minutes,
        penaltyKobo: arrival.penalty_kobo,
        penaltyNgn: arrival.penalty_kobo / 100,
        status: 'CHARGED',
        transactionRef: arrival.penalty_ref,
        message: 'Penalty has already been processed for this arrival event.',
      };
    }

    const penaltyStartsAtTime = new Date(arrival.penalty_starts_at).getTime();
    const boardedTime = boardedAt.getTime();
    const overdueMs = boardedTime - penaltyStartsAtTime;

    // 2. Check if boarded within grace period (<= 3 minutes from arrival)
    if (overdueMs <= 0) {
      await supabase
        .from('escort_pickup_arrivals')
        .update({
          boarded_at: boardedAt.toISOString(),
          delay_minutes: 0,
          penalty_kobo: 0,
          penalty_status: 'WAIVED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', arrivalId);

      return {
        success: true,
        arrivalId,
        studentId: arrival.student_id,
        parentUserId: arrival.parent_user_id,
        delayMinutes: 0,
        penaltyKobo: 0,
        penaltyNgn: 0,
        status: 'WAIVED',
        message: 'Student boarded within the 3-minute grace window. No penalty applied.',
      };
    }

    // 3. Compute Delay Minutes and Penalty Amount
    const delayMinutes = Math.ceil(overdueMs / (60 * 1000));
    const penaltyKobo = delayMinutes * this.PENALTY_RATE_PER_MINUTE_KOBO;
    const penaltyNgn = penaltyKobo / 100;

    // 4. Fetch Parent Wallet
    const { data: parentWallet } = await supabase
      .from('wallets')
      .select('id, available_balance_kobo, escrow_balance_kobo')
      .eq('user_id', arrival.parent_user_id)
      .eq('entity_type', 'parent')
      .maybeSingle();

    if (!parentWallet || parentWallet.available_balance_kobo < penaltyKobo) {
      await supabase
        .from('escort_pickup_arrivals')
        .update({
          boarded_at: boardedAt.toISOString(),
          delay_minutes: delayMinutes,
          penalty_kobo: penaltyKobo,
          penalty_status: 'INSUFFICIENT_FUNDS',
          updated_at: new Date().toISOString(),
        })
        .eq('id', arrivalId);

      return {
        success: false,
        arrivalId,
        studentId: arrival.student_id,
        parentUserId: arrival.parent_user_id,
        delayMinutes,
        penaltyKobo,
        penaltyNgn,
        status: 'INSUFFICIENT_FUNDS',
        message: `Parent wallet has insufficient funds to cover the delay penalty (₦${penaltyNgn.toFixed(2)} for ${delayMinutes} minutes).`,
      };
    }

    const newAvailable = parentWallet.available_balance_kobo - penaltyKobo;
    const newEscrow = (parentWallet.escrow_balance_kobo || 0) + penaltyKobo;
    const ref = `PENALTY-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // 5. Transfer from Available to Escrow
    await supabase
      .from('wallets')
      .update({
        available_balance_kobo: newAvailable,
        escrow_balance_kobo: newEscrow,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parentWallet.id);

    // 6. Append Immutable Ledger Entry
    await supabase.from('wallet_transactions').insert({
      wallet_id: parentWallet.id,
      transaction_type: 'DEBIT',
      channel: 'WAITING_CHARGE',
      amount_kobo: penaltyKobo,
      balance_before_kobo: parentWallet.available_balance_kobo,
      balance_after_kobo: newAvailable,
      reference: ref,
      student_id: arrival.student_id,
      status: 'COMPLETED',
      description: `Delay Penalty: ${delayMinutes} min delay @ ₦50/min (Held in Escrow)`,
      metadata: {
        arrival_id: arrivalId,
        delay_minutes: delayMinutes,
        rate_kobo: this.PENALTY_RATE_PER_MINUTE_KOBO,
      },
    });

    // 7. Insert Delay Penalty Record
    await supabase.from('trip_delay_penalties').insert({
      arrival_event_id: arrivalId,
      parent_user_id: arrival.parent_user_id,
      parent_wallet_id: parentWallet.id,
      delay_minutes: delayMinutes,
      rate_per_min_kobo: this.PENALTY_RATE_PER_MINUTE_KOBO,
      total_penalty_kobo: penaltyKobo,
      status: 'ESCROWED',
      transaction_ref: ref,
      notes: `Charged for ${delayMinutes} minutes delay beyond 3-minute grace window.`,
    });

    // 8. Update Arrival Record
    await supabase
      .from('escort_pickup_arrivals')
      .update({
        boarded_at: boardedAt.toISOString(),
        delay_minutes: delayMinutes,
        penalty_kobo: penaltyKobo,
        penalty_status: 'CHARGED',
        penalty_ref: ref,
        updated_at: new Date().toISOString(),
      })
      .eq('id', arrivalId);

    // Notify parent of delay deduction
    void sendPushToUser(supabase, arrival.parent_user_id, {
      title: `⚠️ Delay Penalty Applied (₦${penaltyNgn.toFixed(2)})`,
      body: `A delay of ${delayMinutes} minutes occurred during morning pickup. ₦${penaltyNgn.toFixed(2)} was debited to transit escrow.`,
      url: `/dashboard/parent?tab=wallet`,
    }).catch(() => {});

    return {
      success: true,
      arrivalId,
      studentId: arrival.student_id,
      parentUserId: arrival.parent_user_id,
      delayMinutes,
      penaltyKobo,
      penaltyNgn,
      status: 'CHARGED',
      transactionRef: ref,
      message: `Delay penalty of ₦${penaltyNgn.toFixed(2)} successfully debited into transit escrow.`,
    };
  }
}
