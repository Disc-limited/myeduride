import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAdminClient } from '@/lib/supabase/admin';
import { todayInLagos } from '@/lib/timezone';
import { TripFareEngine } from '@/lib/payments/trip-fare-engine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/escort/dropoff
 *
 * Implements Daisaf Wallet System Specification Section 2.2 & Section 8:
 * - Records afternoon doorstep drop-off handover
 * - Deducts ₦25 (2,500 kobo) Pay-As-You-Go dropoff fee (School Wallet -> Daisaf, or Parent -> Escrow)
 * - Completes Leg 2 of the daily trip, releasing transit fare into escrow settlement queue
 * - Emits safe arrival alert to parents
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Unauthorized escort session' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const studentId = body.student_id as string | undefined;

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
      .select('id, name, wallet_mode, is_wallet_active, school_escort_dropoff_fee_kobo')
      .eq('id', student.school_id)
      .maybeSingle();

    const dropoffFeeKobo = school?.school_escort_dropoff_fee_kobo ? Number(school.school_escort_dropoff_fee_kobo) : 2500; // ₦25
    const walletMode = school?.wallet_mode || 'school_funded';
    const studentName = `${student.first_name} ${student.last_name}`;
    const escortName = session.full_name || 'MyEduRide Escort';

    // 2. Process ₦25 Pay-As-You-Go Dropoff Fee
    let feeDeducted = false;
    let transactionRef: string | null = null;

    if (school?.is_wallet_active !== false && walletMode !== 'inactive') {
      const ref = `ESC-DROP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      transactionRef = ref;

      if (walletMode === 'parent_funded') {
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

          if (parentWallet && parentWallet.available_balance_kobo >= dropoffFeeKobo) {
            const newBal = parentWallet.available_balance_kobo - dropoffFeeKobo;
            const newEscrow = (parentWallet.escrow_balance_kobo || 0) + dropoffFeeKobo;

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
              channel: 'ESCORT_DROPOFF_FEE',
              amount_kobo: dropoffFeeKobo,
              balance_before_kobo: parentWallet.available_balance_kobo,
              balance_after_kobo: newBal,
              reference: ref,
              student_id: studentId,
              status: 'COMPLETED',
              description: `Escort Afternoon Drop-Off Fee (₦25 held in Escrow)`,
            });
            feeDeducted = true;
          }
        }
      } else {
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

        if (schoolWallet && schoolWallet.available_balance_kobo >= dropoffFeeKobo) {
          const newSchoolBal = schoolWallet.available_balance_kobo - dropoffFeeKobo;
          await supabase
            .from('wallets')
            .update({ available_balance_kobo: newSchoolBal, updated_at: now.toISOString() })
            .eq('id', schoolWallet.id);

          if (daisafWallet) {
            await supabase
              .from('wallets')
              .update({
                available_balance_kobo: (daisafWallet.available_balance_kobo || 0) + dropoffFeeKobo,
                updated_at: now.toISOString(),
              })
              .eq('id', daisafWallet.id);
          }

          await supabase.from('wallet_transactions').insert([
            {
              wallet_id: schoolWallet.id,
              counterpart_wallet_id: daisafWallet?.id || null,
              transaction_type: 'DEBIT',
              channel: 'ESCORT_DROPOFF_FEE',
              amount_kobo: dropoffFeeKobo,
              balance_before_kobo: schoolWallet.available_balance_kobo,
              balance_after_kobo: newSchoolBal,
              reference: ref,
              student_id: studentId,
              status: 'COMPLETED',
              description: `School Escort Afternoon Drop-Off Fee (₦25 Pay-As-You-Go)`,
            },
            {
              wallet_id: daisafWallet?.id || schoolWallet.id,
              counterpart_wallet_id: schoolWallet.id,
              transaction_type: 'CREDIT',
              channel: 'ESCORT_DROPOFF_FEE',
              amount_kobo: dropoffFeeKobo,
              balance_before_kobo: daisafWallet?.available_balance_kobo || 0,
              balance_after_kobo: (daisafWallet?.available_balance_kobo || 0) + dropoffFeeKobo,
              reference: `${ref}-REV`,
              student_id: studentId,
              status: 'COMPLETED',
              description: `School Escort Drop-Off Revenue (₦25 Pay-As-You-Go)`,
            },
          ]);
          feeDeducted = true;
        }
      }
    }

    // 3. Update or Insert Daily Trip Record
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
          afternoon_picked_up: true,
          afternoon_picked_up_at: existingTrip.afternoon_picked_up_at || now.toISOString(),
          afternoon_dropped_off: true,
          afternoon_dropped_off_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', existingTrip.id);
    } else {
      await supabase.from('escort_student_daily_trips').insert({
        trip_date: today,
        escort_id: session.user_id,
        student_id: studentId,
        school_id: student.school_id,
        afternoon_picked_up: true,
        afternoon_picked_up_at: now.toISOString(),
        afternoon_dropped_off: true,
        afternoon_dropped_off_at: now.toISOString(),
        updated_at: now.toISOString(),
      });
    }

    // 4. Financial Leg 2 Completion & Fare Release Check
    let legCompletionResult: any = null;
    try {
      legCompletionResult = await TripFareEngine.recordLegCompletion({
        studentId,
        legType: 'dropoff',
        verifiedByUserId: session.user_id,
      });
    } catch (legErr) {
      console.warn('[POST /api/escort/dropoff] Leg completion note:', legErr);
    }

    // 5. Safe Arrival Notification to Parent
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
          title: `🏡 Safe Arrival Home: ${studentName}`,
          message: `${studentName} has safely arrived and been handed over at your doorstep by Escort ${escortName}.`,
          type: 'escort_dropoff',
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
      action: 'afternoon_dropoff',
      student_id: studentId,
      student_name: studentName,
      fee_deducted_kobo: feeDeducted ? dropoffFeeKobo : 0,
      fee_deducted_ngn: feeDeducted ? dropoffFeeKobo / 100 : 0,
      transaction_ref: transactionRef,
      both_legs_completed: Boolean(legCompletionResult?.both_legs_completed),
      message: `${studentName} afternoon doorstep drop-off confirmed successfully.`,
    });
  } catch (err: any) {
    console.error('[POST /api/escort/dropoff] Crash:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
