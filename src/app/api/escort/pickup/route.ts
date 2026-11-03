import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAdminClient } from '@/lib/supabase/admin';
import { todayInLagos } from '@/lib/timezone';
import { DelayPenaltyEngine } from '@/lib/escort/delay-penalty-engine';
import { TripFareEngine } from '@/lib/payments/trip-fare-engine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/escort/pickup
 *
 * Implements Daisaf Wallet System Specification Section 2.2, 3.2 & Section 8:
 * - Records morning pickup boarding
 * - Deducts ₦25 (2,500 kobo) Pay-As-You-Go fee (from School Wallet into Daisaf, or Parent into Escrow)
 * - Automatically checks and finalizes ₦50/min delay penalty if child was delayed beyond 3-minute grace window
 * - Emits safe boarding alert to parents
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Unauthorized escort session' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const studentId = body.student_id as string | undefined;
    const arrivalId = body.arrival_id as string | undefined;
    const pinCode = body.pin_code as string | undefined;

    if (!studentId) {
      return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const today = todayInLagos();
    const now = new Date();

    // 1. Fetch Student & School Record
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, school_id, is_active')
      .eq('id', studentId)
      .maybeSingle();

    if (studentErr || !student || student.is_active === false) {
      return NextResponse.json({ error: 'Student not found or inactive' }, { status: 404 });
    }

    const { data: school } = await supabase
      .from('schools')
      .select('id, name, wallet_mode, is_wallet_active, school_escort_pickup_fee_kobo')
      .eq('id', student.school_id)
      .maybeSingle();

    const pickupFeeKobo = school?.school_escort_pickup_fee_kobo ? Number(school.school_escort_pickup_fee_kobo) : 2500; // ₦25
    const walletMode = school?.wallet_mode || 'school_funded';
    const studentName = `${student.first_name} ${student.last_name}`;
    const escortName = session.full_name || 'MyEduRide Escort';

    // 2. Handle Potential Delay Penalty Evaluation
    let penaltyResult: any = null;
    let targetArrivalId = arrivalId;

    if (!targetArrivalId) {
      // Find today's latest uncompleted arrival event for this student
      const { data: latestArrival } = await supabase
        .from('escort_pickup_arrivals')
        .select('id')
        .eq('student_id', studentId)
        .eq('penalty_status', 'NONE')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      targetArrivalId = latestArrival?.id;
    }

    if (targetArrivalId) {
      try {
        penaltyResult = await DelayPenaltyEngine.computeAndApplyDelayPenalty({
          arrivalId: targetArrivalId,
          boardedAt: now,
        });
      } catch (penErr) {
        console.warn('[POST /api/escort/pickup] Delay penalty calculation note:', penErr);
      }
    }

    // 3. Process ₦25 Pay-As-You-Go Pickup Fee
    let feeDeducted = false;
    let transactionRef: string | null = null;

    if (school?.is_wallet_active !== false && walletMode !== 'inactive') {
      const ref = `ESC-PICK-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      transactionRef = ref;

      if (walletMode === 'parent_funded') {
        // Parent Direct Payer Mode
        const { data: parentLink } = await supabase
          .from('student_parents')
          .select('parent_user_id')
          .eq('student_id', studentId)
          .order('is_primary', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (parentLink?.parent_user_id) {
          const { data: parentWallet } = await supabase
            .from('wallets')
            .select('id, available_balance_kobo, escrow_balance_kobo')
            .eq('user_id', parentLink.parent_user_id)
            .eq('entity_type', 'parent')
            .maybeSingle();

          if (parentWallet && parentWallet.available_balance_kobo >= pickupFeeKobo) {
            const newBal = parentWallet.available_balance_kobo - pickupFeeKobo;
            const newEscrow = (parentWallet.escrow_balance_kobo || 0) + pickupFeeKobo;

            await supabase
              .from('wallets')
              .update({
                available_balance_kobo: newBal,
                escrow_balance_kobo: newEscrow,
                updated_at: now.toISOString(),
              })
              .eq('id', parentWallet.id);

            await supabase.from('wallet_transactions').insert({
              wallet_id: parentWallet.id,
              transaction_type: 'DEBIT',
              channel: 'ESCORT_PICKUP_FEE',
              amount_kobo: pickupFeeKobo,
              balance_before_kobo: parentWallet.available_balance_kobo,
              balance_after_kobo: newBal,
              reference: ref,
              student_id: studentId,
              status: 'COMPLETED',
              description: `Escort Morning Pickup Fee (₦25 held in Escrow)`,
            });
            feeDeducted = true;
          }
        }
      } else {
        // School-Funded Mode: School Wallet -> Daisaf Revenue
        const { data: schoolWallet } = await supabase
          .from('wallets')
          .select('id, available_balance_kobo')
          .eq('school_id', student.school_id)
          .eq('entity_type', 'school')
          .maybeSingle();

        let { data: daisafWallet } = await supabase
          .from('wallets')
          .select('id, available_balance_kobo')
          .in('entity_type', ['daisaf', 'platform_treasury'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (schoolWallet && schoolWallet.available_balance_kobo >= pickupFeeKobo) {
          const newSchoolBal = schoolWallet.available_balance_kobo - pickupFeeKobo;
          await supabase
            .from('wallets')
            .update({ available_balance_kobo: newSchoolBal, updated_at: now.toISOString() })
            .eq('id', schoolWallet.id);

          if (daisafWallet) {
            await supabase
              .from('wallets')
              .update({
                available_balance_kobo: (daisafWallet.available_balance_kobo || 0) + pickupFeeKobo,
                updated_at: now.toISOString(),
              })
              .eq('id', daisafWallet.id);
          }

          await supabase.from('wallet_transactions').insert([
            {
              wallet_id: schoolWallet.id,
              counterpart_wallet_id: daisafWallet?.id || null,
              transaction_type: 'DEBIT',
              channel: 'ESCORT_PICKUP_FEE',
              amount_kobo: pickupFeeKobo,
              balance_before_kobo: schoolWallet.available_balance_kobo,
              balance_after_kobo: newSchoolBal,
              reference: ref,
              student_id: studentId,
              status: 'COMPLETED',
              description: `School Escort Morning Pickup Fee (₦25 Pay-As-You-Go)`,
            },
            {
              wallet_id: daisafWallet?.id || schoolWallet.id,
              counterpart_wallet_id: schoolWallet.id,
              transaction_type: 'CREDIT',
              channel: 'ESCORT_PICKUP_FEE',
              amount_kobo: pickupFeeKobo,
              balance_before_kobo: daisafWallet?.available_balance_kobo || 0,
              balance_after_kobo: (daisafWallet?.available_balance_kobo || 0) + pickupFeeKobo,
              reference: `${ref}-REV`,
              student_id: studentId,
              status: 'COMPLETED',
              description: `School Escort Pickup Revenue (₦25 Pay-As-You-Go)`,
            },
          ]);
          feeDeducted = true;
        }
      }
    }

    // 4. Update or Insert Daily Trip Record
    const { data: existingTrip } = await supabase
      .from('escort_student_daily_trips')
      .select('*')
      .eq('trip_date', today)
      .eq('student_id', studentId)
      .maybeSingle();

    if (existingTrip) {
      await supabase
        .from('escort_student_daily_trips')
        .update({
          morning_picked_up: true,
          morning_picked_up_at: now.toISOString(),
          morning_pin_verified: Boolean(pinCode),
          updated_at: now.toISOString(),
        })
        .eq('id', existingTrip.id);
    } else {
      await supabase.from('escort_student_daily_trips').insert({
        trip_date: today,
        escort_id: session.user_id,
        student_id: studentId,
        school_id: student.school_id,
        morning_picked_up: true,
        morning_picked_up_at: now.toISOString(),
        morning_pin_verified: Boolean(pinCode),
        updated_at: now.toISOString(),
      });
    }

    // 5. Financial Leg Tracking
    try {
      await TripFareEngine.recordLegCompletion({
        studentId,
        legType: 'pickup',
        verifiedByUserId: session.user_id,
      });
    } catch (legErr) {
      console.warn('[POST /api/escort/pickup] Leg completion note:', legErr);
    }

    // 6. Safe Boarding Notification to Parent
    const { data: parents } = await supabase
      .from('student_parents')
      .select('parent_user_id')
      .eq('student_id', studentId);

    if (parents && parents.length > 0) {
      const notifs = parents
        .filter((p) => p.parent_user_id)
        .map((p) => ({
          user_id: p.parent_user_id,
          school_id: student.school_id,
          student_id: studentId,
          title: `🚐 Safe Boarding: ${studentName}`,
          message: `${studentName} has safely boarded with Escort ${escortName}. Transit to school is underway.`,
          type: 'escort_pickup',
          is_read: false,
        }));

      try {
        await supabase.from('notifications').insert(notifs);
      } catch {
        // notification non-critical
      }
    }

    return NextResponse.json({
      success: true,
      action: 'morning_pickup',
      student_id: studentId,
      student_name: studentName,
      fee_deducted_kobo: feeDeducted ? pickupFeeKobo : 0,
      fee_deducted_ngn: feeDeducted ? pickupFeeKobo / 100 : 0,
      transaction_ref: transactionRef,
      delay_penalty: penaltyResult
        ? {
            applied: penaltyResult.status === 'CHARGED',
            delay_minutes: penaltyResult.delayMinutes,
            penalty_ngn: penaltyResult.penaltyNgn,
            status: penaltyResult.status,
          }
        : null,
      message: `${studentName} morning pickup confirmed successfully.`,
    });
  } catch (err: any) {
    console.error('[POST /api/escort/pickup] Crash:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
