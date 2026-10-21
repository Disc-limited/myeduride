import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { todayInLagos, nowUtcIso } from '@/lib/timezone';
import { TripFareEngine } from '@/lib/payments/trip-fare-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow sufficient execution window for multi-trip batch settlement

/**
 * Validates request authorization:
 * 1. Bearer token matching CRON_SECRET
 * 2. x-cron-secret header matching CRON_SECRET
 * 3. Authenticated Super Admin session
 * 4. Permissive during local development if CRON_SECRET is not configured
 */
function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const xCronHeader = request.headers.get('x-cron-secret');

  if (cronSecret) {
    if (xCronHeader === cronSecret) return true;
    if (authHeader && authHeader === `Bearer ${cronSecret}`) return true;
  }

  // Super Admin session check
  const session = getSessionFromRequest(request);
  if (session && session.roles?.some((r) => r.role === 'super_admin')) {
    return true;
  }

  // Local development fallback
  if (process.env.NODE_ENV === 'development' && !cronSecret) {
    return true;
  }

  return false;
}

/**
 * 7:00 PM EVENING ESCROW SETTLEMENT CRON WORKER
 * 
 * Target: Transport Daily Escrow & Automated Escort Settlement (Phase 4)
 * Schedule: 7:00 PM Lagos Time (WAT, UTC+1) / 18:00 UTC Daily.
 * 
 * Execution:
 * 1. Scans all student daily transit records for today.
 * 2. Full completion verification (morning_picked_up = true AND afternoon_dropped_off = true).
 * 3. Batch fare release: transfers held escrow into escort available balance.
 * 4. Incomplete trip vaulting: tags incomplete trips with 'SETTLEMENT_HELD_FOR_REVIEW'.
 * 5. Dispatches high-priority payout alert to compensated escorts.
 */
async function handleSettlement(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid CRON_SECRET or Super Admin session required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date') || todayInLagos();
    const dryRun = searchParams.get('dry_run') === 'true' || searchParams.get('dryRun') === 'true';
    const escortId = searchParams.get('escort_id') || undefined;

    console.log(
      `[EveningSettlementCron] Executing 7:00 PM settlement for date=${dateParam}, dryRun=${dryRun}, escortId=${escortId || 'ALL'}`
    );

    const result = await TripFareEngine.executeEveningEscrowSettlement({
      date: dateParam,
      dryRun,
      escortId,
    });

    return NextResponse.json({
      timestamp: nowUtcIso(),
      settlement_target_time: '19:00:00 (Africa/Lagos)',
      ...result,
    });
  } catch (error: any) {
    console.error('[EveningSettlementCron] Unhandled exception:', error);
    return NextResponse.json(
      {
        error: error.message || 'Internal Server Error during evening escrow settlement',
        timestamp: nowUtcIso(),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleSettlement(request);
}

export async function POST(request: NextRequest) {
  return handleSettlement(request);
}
