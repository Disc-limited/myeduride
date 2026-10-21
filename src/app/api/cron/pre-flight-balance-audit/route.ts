import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { todayInLagos, nowUtcIso } from '@/lib/timezone';
import { PreFlightBalanceAuditEngine } from '@/lib/payments/pre-flight-balance-audit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60s execution window for batch querying, balance reconciliation, and email dispatch

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
 * 6:00 PM NIGHT-BEFORE PRE-FLIGHT BALANCE AUDIT CRON WORKER (PHASE 5)
 * 
 * Schedule: 6:00 PM Lagos Time (WAT, UTC+1) / 17:00 UTC Daily (Vercel cron).
 * 
 * Execution:
 * 1. Identifies tomorrow's operational school day (or Monday if run on Friday/weekend).
 * 2. Aggregates scheduled transport fees across all children per parent.
 * 3. Evaluates parent available wallet balance against required fare.
 * 4. Branch A: Credibility Confirmed (Balance >= Fare) ➔ Sends confirmed in-app alert + email.
 * 5. Branch B: Top-Up Required (Balance < Fare) ➔ Sends urgent top-up advisory + direct wallet CTA link.
 */
async function handleAudit(request: NextRequest) {
  const startTime = performance.now();
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid CRON_SECRET or Super Admin session required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date') || undefined;
    const dryRunParam = searchParams.get('dryRun') === 'true';
    const forceSendParam = searchParams.get('forceSend') === 'true';

    // Parse body parameters if POST
    let bodyTargetDate: string | undefined;
    let bodyDryRun: boolean | undefined;
    let bodyForceSend: boolean | undefined;

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        bodyTargetDate = body.targetDate || body.date;
        bodyDryRun = body.dryRun;
        bodyForceSend = body.forceSend;
      } catch {
        // No or empty body
      }
    }

    const targetDate = bodyTargetDate || dateParam;
    const dryRun = bodyDryRun !== undefined ? bodyDryRun : dryRunParam;
    const forceSend = bodyForceSend !== undefined ? bodyForceSend : forceSendParam;

    const summary = await PreFlightBalanceAuditEngine.executePreFlightBalanceAudit({
      targetDate,
      dryRun,
      forceSend,
    });

    const durationMs = Number((performance.now() - startTime).toFixed(2));

    console.log(
      `[PreFlight Audit Worker] Executed in ${durationMs}ms: target=${summary.targetDate} (${summary.targetDayName}), parents=${summary.totalParentsAudited}, confirmed=${summary.confirmedCount}, topup=${summary.topupRequiredCount}`
    );

    return NextResponse.json({
      success: summary.success,
      execution_timestamp: nowUtcIso(),
      duration_ms: durationMs,
      dry_run: summary.dryRun,
      audit: summary,
    });
  } catch (error: any) {
    console.error('[PreFlight Audit Worker] Unhandled exception:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal Server Error during pre-flight audit execution',
        timestamp: nowUtcIso(),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleAudit(request);
}

export async function POST(request: NextRequest) {
  return handleAudit(request);
}
