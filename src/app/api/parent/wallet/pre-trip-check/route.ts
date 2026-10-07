import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { TripFareEngine } from '@/lib/payments/trip-fare-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { student_id, gross_amount_ngn } = body;

    if (!student_id) {
      return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Verify student belongs to parent via student_parents
    const { data: link, error: linkErr } = await supabase
      .from('student_parents')
      .select('student_id, student:students(id, school_id, first_name, last_name)')
      .eq('parent_user_id', session.user_id)
      .eq('student_id', student_id)
      .maybeSingle();

    if (linkErr || !link || !link.student) {
      return NextResponse.json({ error: 'Student not linked to parent' }, { status: 404 });
    }

    const student = (link as any).student;

    // Convert NGN to Kobo if custom amount passed
    const grossKobo = gross_amount_ngn ? Math.round(Number(gross_amount_ngn) * 100) : undefined;

    const result = await TripFareEngine.authorizeStudentTrip({
      studentId: student.id,
      parentUserId: session.user_id,
      schoolId: student.school_id,
      grossKobo,
    });

    if (!result.authorized) {
      return NextResponse.json({
        success: false,
        authorized: false,
        error: result.error,
        available_balance_ngn: result.available_balance_ngn,
        required_ngn: result.required_ngn,
        message:
          "Your MyEduRide wallet balance is insufficient for today's scheduled transport. Please fund your wallet to authorize pickup and drop-off.",
      });
    }

    return NextResponse.json({
      success: true,
      authorized: true,
      reference: result.reference,
      escrow_hold_id: result.escrow_hold_id,
      pickup_leg_id: result.pickup_leg_id,
      dropoff_leg_id: result.dropoff_leg_id,
      message: 'Transport authorized. Transit fee held securely in escrow.',
    });
  } catch (err: any) {
    console.error('[PreTripCheck API] Exception:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
