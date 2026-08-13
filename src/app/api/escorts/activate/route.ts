import { NextRequest, NextResponse } from 'next/server';
import { updateEscortApplicationStatus } from '@/lib/escort/escort-db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appId = 'APP-ESC-901', paymentMethod = 'card' } = body;

    const result = await updateEscortApplicationStatus(appId, 'ACTIVATED', `Registration payment completed via ${paymentMethod}`);

    return NextResponse.json({
      success: true,
      status: 'ACTIVATED',
      paymentConfirmed: true,
      amountPaid: 1200,
      message: 'Registration payment activated! Full operational Escort features unlocked.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Activation payment failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
