import { NextRequest, NextResponse } from 'next/server';
import { checkEscortEmailOrUsernameExists } from '@/lib/escort/escort-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const emailOrUsername = searchParams.get('emailOrUsername') || searchParams.get('email') || '';

  if (!emailOrUsername.trim()) {
    return NextResponse.json({ exists: false });
  }

  try {
    const result = await checkEscortEmailOrUsernameExists(emailOrUsername);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error checking email';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const emailOrUsername = body.emailOrUsername || body.email || '';

    if (!emailOrUsername.trim()) {
      return NextResponse.json({ exists: false });
    }

    const result = await checkEscortEmailOrUsernameExists(emailOrUsername);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error checking email';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
