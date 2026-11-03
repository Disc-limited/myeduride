import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAdminClient } from '@/lib/supabase/admin';
import { DelayPenaltyEngine } from '@/lib/escort/delay-penalty-engine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/escort/confirm
 *
 * Implements Daisaf Wallet System Specification Section 3.2 & Section 8:
 * Escort taps "I Am Here for Pickup":
 * 1. Checks if Parent Wallet (or School Wallet) has sufficient funds for transit service.
 *    - If NO -> Restricts service, notifies parent to fund wallet immediately.
 * 2. GPS Geofence verification against student house coordinates (150m tolerance).
 * 3. Records arrival event, initiates 2-minute grace countdown + 1-minute scan allowance (3 minutes total).
 * 4. Alerts parent: "Your escort has arrived. You have 2 minutes to bring your child."
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Unauthorized escort session' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const studentId = body.student_id as string | undefined;
    const currentLat = Number(body.current_lat ?? body.lat ?? body.latitude);
    const currentLng = Number(body.current_lng ?? body.lng ?? body.longitude);
    const tripId = body.trip_id as string | undefined;

    if (!studentId) {
      return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
    }

    if (isNaN(currentLat) || isNaN(currentLng)) {
      return NextResponse.json({ error: 'Valid current GPS coordinates (current_lat, current_lng) are required' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // 1. Fetch Student & Linked School
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, school_id, house_lat, house_lng, is_active')
      .eq('id', studentId)
      .maybeSingle();

    if (studentErr || !student || student.is_active === false) {
      return NextResponse.json({ error: 'Student record not found or inactive' }, { status: 404 });
    }

    // 2. Resolve School Wallet Mode & Required Pickup Fee
    const { data: school } = await supabase
      .from('schools')
      .select('id, name, wallet_mode, is_wallet_active, school_escort_pickup_fee_kobo')
      .eq('id', student.school_id)
      .maybeSingle();

    const requiredPickupFeeKobo = school?.school_escort_pickup_fee_kobo ? Number(school.school_escort_pickup_fee_kobo) : 2500; // ₦25 (2,500 kobo)
    const requiredPickupFeeNgn = requiredPickupFeeKobo / 100;
    const walletMode = school?.wallet_mode || 'school_funded';

    // 3. Pre-Service Wallet Balance Check (Section 3.2 Rule 2)
    if (school?.is_wallet_active !== false && walletMode !== 'inactive') {
      if (walletMode === 'parent_funded') {
        // Resolve parent wallet
        const { data: parentLink } = await supabase
          .from('student_parents')
          .select('parent_user_id')
          .eq('student_id', studentId)
          .order('is_primary', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!parentLink?.parent_user_id) {
          return NextResponse.json(
            { error: 'This student has no registered parent account. Pickup restricted.', code: 'unregistered_student' },
            { status: 403 }
          );
        }

        const { data: parentWallet } = await supabase
          .from('wallets')
          .select('id, available_balance_kobo')
          .eq('user_id', parentLink.parent_user_id)
          .eq('entity_type', 'parent')
          .maybeSingle();

        const availableKobo = parentWallet?.available_balance_kobo || 0;
        if (availableKobo < requiredPickupFeeKobo) {
          // Send urgent funding alert to parent
          await supabase.from('notifications').insert({
            user_id: parentLink.parent_user_id,
            student_id: student.id,
            title: '⚠️ Insufficient Funds: Escort Pickup On Hold',
            message: `Your escort is at your location, but your transit wallet balance (₦${(availableKobo / 100).toFixed(2)}) is insufficient for morning pickup (₦${requiredPickupFeeNgn.toFixed(2)} required). Please top up now to authorize boarding.`,
            type: 'financial_alert',
            metadata: {
              alert_code: 'INSUFFICIENT_PICKUP_BALANCE',
              required_ngn: requiredPickupFeeNgn,
              available_ngn: availableKobo / 100,
            },
          });

          return NextResponse.json(
            {
              error: 'Parent wallet has insufficient funds for escort pickup.',
              code: 'insufficient_funds',
              payer_type: 'parent',
              available_balance_kobo: availableKobo,
              available_balance_ngn: availableKobo / 100,
              required_kobo: requiredPickupFeeKobo,
              required_ngn: requiredPickupFeeNgn,
              message: `Service restricted: Parent wallet balance (₦${(availableKobo / 100).toFixed(2)}) is less than pickup fee (₦${requiredPickupFeeNgn.toFixed(2)}). Parent has been notified to fund wallet.`,
            },
            { status: 402 }
          );
        }
      } else {
        // School-funded mode: check school wallet
        const { data: schoolWallet } = await supabase
          .from('wallets')
          .select('id, available_balance_kobo')
          .eq('school_id', student.school_id)
          .eq('entity_type', 'school')
          .maybeSingle();

        const availableKobo = schoolWallet?.available_balance_kobo || 0;
        if (availableKobo < requiredPickupFeeKobo) {
          return NextResponse.json(
            {
              error: 'School wallet balance is insufficient for escort transit.',
              code: 'insufficient_funds',
              payer_type: 'school',
              available_balance_kobo: availableKobo,
              available_balance_ngn: availableKobo / 100,
              required_kobo: requiredPickupFeeKobo,
              required_ngn: requiredPickupFeeNgn,
              message: `School wallet balance (₦${(availableKobo / 100).toFixed(2)}) is insufficient. Please fund institutional wallet.`,
            },
            { status: 402 }
          );
        }
      }
    }

    // 4. Record Arrival & Start Grace Window
    const arrivalResult = await DelayPenaltyEngine.recordEscortArrival({
      studentId,
      escortId: session.user_id,
      escortLat: currentLat,
      escortLng: currentLng,
      escortName: session.full_name,
      escortUserId: session.user_id,
      tripId,
    });

    if (!arrivalResult.success) {
      return NextResponse.json(
        { error: arrivalResult.error || 'Failed to record escort arrival' },
        { status: 400 }
      );
    }

    const studentName = `${student.first_name} ${student.last_name}`;

    return NextResponse.json({
      success: true,
      arrival_id: arrivalResult.arrivalId,
      student_id: studentId,
      student_name: studentName,
      distance_meters: arrivalResult.distanceMeters,
      geofence_passed: arrivalResult.geofencePassed,
      arrived_at: arrivalResult.arrivedAt,
      grace_expires_at: arrivalResult.graceExpiresAt,
      penalty_starts_at: arrivalResult.penaltyStartsAt,
      message: 'Your escort has arrived. You have 2 minutes to bring your child.',
      instructions: arrivalResult.geofencePassed
        ? 'GPS geofence verified within 150m. Grace period active.'
        : `GPS location is ${arrivalResult.distanceMeters}m from student residence (tolerance: 150m). Proceed with caution.`,
    });
  } catch (err: any) {
    console.error('[POST /api/escort/confirm] Crash:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
