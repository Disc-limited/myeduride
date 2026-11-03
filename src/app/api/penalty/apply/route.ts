import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAdminClient } from '@/lib/supabase/admin';
import { DelayPenaltyEngine } from '@/lib/escort/delay-penalty-engine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/penalty/apply
 *
 * Implements Daisaf Wallet System Specification Section 3.2 & Section 8:
 * - Calculates and applies delay penalty for delayed parent student handover
 * - Rate: ₦50.00 / minute (5,000 kobo/min)
 * - Window: Triggered when student is boarded beyond the 3-minute grace window (2 min grace + 1 min scan)
 * - Debited from Parent Wallet and locked in Escrow
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    let arrivalId = body.arrival_id as string | undefined;
    const studentId = body.student_id as string | undefined;
    const boardedAtStr = body.boarded_at as string | undefined;
    const boardedAt = boardedAtStr ? new Date(boardedAtStr) : new Date();

    const supabase = getAdminClient();

    // 1. Resolve Arrival Event ID
    if (!arrivalId && studentId) {
      const { data: latestArrival } = await supabase
        .from('escort_pickup_arrivals')
        .select('id')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      arrivalId = latestArrival?.id;
    }

    if (!arrivalId) {
      return NextResponse.json(
        { error: 'arrival_id or student_id with an active arrival event is required.' },
        { status: 400 }
      );
    }

    // 2. Compute and Apply Penalty
    const result = await DelayPenaltyEngine.computeAndApplyDelayPenalty({
      arrivalId,
      boardedAt,
    });

    if (!result.success && result.status !== 'INSUFFICIENT_FUNDS') {
      return NextResponse.json({ error: result.error || 'Failed to compute delay penalty' }, { status: 400 });
    }

    return NextResponse.json({
      success: result.success,
      penalty_applied: result.status === 'CHARGED',
      arrival_id: result.arrivalId,
      student_id: result.studentId,
      parent_user_id: result.parentUserId,
      delayed_minutes: result.delayMinutes,
      rate_kobo_per_minute: DelayPenaltyEngine.PENALTY_RATE_PER_MINUTE_KOBO,
      penalty_kobo: result.penaltyKobo,
      penalty_ngn: result.penaltyNgn,
      status: result.status,
      transaction_ref: result.transactionRef,
      message: result.message,
    });
  } catch (err: any) {
    console.error('[POST /api/penalty/apply] Crash:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
