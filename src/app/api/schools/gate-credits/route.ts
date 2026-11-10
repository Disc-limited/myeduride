import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { GateBillingEngine } from '@/lib/payments/gate-billing-engine';
import { getOrCreateSchoolWallet } from '@/lib/school/school-wallet';
import { compileAndDispatchMonthlyGateCreditReport } from '@/lib/notifications/email-templates/monthly-gate-credit-report';

export const dynamic = 'force-dynamic';

async function resolveAndAuthorizeSchool(session: any, requestedSchoolId?: string | null): Promise<{ allowed: boolean; schoolId: string | null }> {
  if (!session?.user_id) return { allowed: false, schoolId: null };

  const sessionRoles = Array.isArray(session.roles) ? session.roles : [];
  const isSessionSuperAdmin = sessionRoles.some((r: any) => r.role === 'super_admin');

  const supabase = getAdminClient();
  const { data: dbRoles } = await supabase
    .from('user_school_roles')
    .select('school_id, role, is_active')
    .eq('user_id', session.user_id)
    .eq('is_active', true);

  const allRoles = [...sessionRoles, ...(dbRoles || [])];
  const isSuperAdmin = isSessionSuperAdmin || allRoles.some((r: any) => r.role === 'super_admin');
  const adminSchoolIds = allRoles
    .filter((r: any) => ['school_admin', 'principal', 'bursar', 'finance_officer', 'super_admin'].includes(r.role))
    .map((r: any) => r.school_id)
    .filter(Boolean);

  if (requestedSchoolId) {
    if (isSuperAdmin || adminSchoolIds.includes(requestedSchoolId)) {
      return { allowed: true, schoolId: requestedSchoolId };
    }
    return { allowed: false, schoolId: requestedSchoolId };
  }

  const fallbackSchoolId =
    adminSchoolIds[0] ||
    (session as any).primary_school_id ||
    (session as any).primary_school?.id ||
    allRoles.find((r: any) => r.school_id)?.school_id ||
    null;

  return {
    allowed: !!(isSuperAdmin || (fallbackSchoolId && adminSchoolIds.includes(fallbackSchoolId))),
    schoolId: fallbackSchoolId,
  };
}

/**
 * GET /api/schools/gate-credits?school_id=...
 * Returns full Gate Credit balance, packages, wallet float, documented transactions, and monthly reports
 * for the School Admin Dashboard.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const requestedSchoolId = request.nextUrl.searchParams.get('school_id');
    const { allowed, schoolId } = await resolveAndAuthorizeSchool(session, requestedSchoolId);

    if (!schoolId) {
      return NextResponse.json({ error: 'school_id is required' }, { status: 400 });
    }

    if (!allowed) {
      return NextResponse.json({ error: 'School Admin access required' }, { status: 403 });
    }

    const entryTypeFilter = request.nextUrl.searchParams.get('entry_type') || 'ALL';
    const limit = Math.min(200, Math.max(10, parseInt(request.nextUrl.searchParams.get('limit') || '100', 10)));

    const supabase = getAdminClient();

    // 1. Fetch School Credit Vault
    const { data: school, error: schoolErr } = await supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .maybeSingle();

    if (schoolErr) {
      console.error('[api/schools/gate-credits GET] school query error:', schoolErr);
      return NextResponse.json({ error: schoolErr.message }, { status: 500 });
    }

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    // 2. Fetch or Initialize School Wallet (for cash float balance & virtual account details)
    let walletData: any = null;
    try {
      const { wallet } = await getOrCreateSchoolWallet(schoolId);
      walletData = wallet;
    } catch {
      const { data: fallbackWallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('school_id', schoolId)
        .eq('entity_type', 'school')
        .maybeSingle();
      walletData = fallbackWallet;
    }

    // 3. Fetch Active Packages
    const { data: dbPackages } = await supabase
      .from('gate_credit_packages')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    const packages =
      dbPackages && dbPackages.length > 0
        ? dbPackages.map((p: any) => ({
            id: p.id,
            name: p.name,
            units: Number(p.units),
            price_kobo: Number(p.price_kobo),
            price_ngn: Number(p.price_kobo) / 100,
            daily_equivalent: Number(p.daily_equivalent || p.units),
            description: p.description,
            badge_text: p.badge_text,
            display_order: p.display_order,
          }))
        : GateBillingEngine.DEFAULT_PACKAGES;

    // 4. Fetch Credit Ledger Entries
    let ledgerQuery = supabase
      .from('school_gate_credit_ledger')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (entryTypeFilter && entryTypeFilter !== 'ALL') {
      ledgerQuery = ledgerQuery.eq('entry_type', entryTypeFilter);
    }

    const { data: ledgerRows } = await ledgerQuery;

    // 5. Compute Summary Metrics
    const { data: allSchoolLedger } = await supabase
      .from('school_gate_credit_ledger')
      .select('entry_type, units_delta_milli, amount_kobo, scan_type, created_at')
      .eq('school_id', schoolId);

    const now = new Date();
    const monthStartIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const todayStartIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

    let totalUnitsPurchasedMilli = 0;
    let totalUnitsTrialMilli = 0;
    let totalUnitsConsumedMilli = 0;
    let monthUnitsConsumedMilli = 0;
    let todayUnitsConsumedMilli = 0;
    let totalClockIns = 0;
    let totalClockOuts = 0;
    let totalSpentKobo = 0;

    for (const row of allSchoolLedger || []) {
      const delta = Number(row.units_delta_milli || 0);
      if (row.entry_type === 'PURCHASE' || row.entry_type === 'ADJUSTMENT_CREDIT') {
        totalUnitsPurchasedMilli += Math.max(0, delta);
        totalSpentKobo += Number(row.amount_kobo || 0);
      } else if (row.entry_type === 'FREE_TRIAL') {
        totalUnitsTrialMilli += Math.max(0, delta);
      } else if (row.entry_type === 'CONSUMPTION_SCAN' || row.entry_type === 'ADJUSTMENT_DEBIT') {
        const absDelta = Math.abs(delta);
        totalUnitsConsumedMilli += absDelta;
        if (row.created_at >= monthStartIso) {
          monthUnitsConsumedMilli += absDelta;
        }
        if (row.created_at >= todayStartIso) {
          todayUnitsConsumedMilli += absDelta;
        }
        if (row.scan_type === 'clock_in') totalClockIns++;
        if (row.scan_type === 'clock_out') totalClockOuts++;
      }
    }

    // 6. Fetch Monthly Reports
    const { data: monthlyReports } = await supabase
      .from('school_gate_monthly_reports')
      .select('*')
      .eq('school_id', schoolId)
      .order('report_month', { ascending: false })
      .limit(12);

    const remainingMilli = Number(school.gate_credit_balance_milli ?? 0);
    const remainingUnits = Number((remainingMilli / 1000).toFixed(1));
    const lowThreshold = Number(school.low_credit_threshold_units ?? 10);
    const walletBalKobo = Number(walletData?.available_balance_kobo ?? 0);

    return NextResponse.json({
      school: {
        id: school.id,
        name: school.name,
        email: (school as any).contact_email || (school as any).email || null,
      },
      credits: {
        remaining_units: remainingUnits,
        remaining_units_milli: remainingMilli,
        remaining_scans: Math.floor(remainingMilli / 500),
        low_threshold_units: lowThreshold,
        status: remainingMilli < 500 ? 'exhausted' : remainingUnits <= lowThreshold ? 'low' : 'healthy',
        free_trial_claimed: !!school.free_trial_credits_claimed,
        free_trial_claimed_at: school.free_trial_claimed_at,
        unit_daily_cost_ngn: 6,
        scan_unit_cost: 0.5,
        scan_cost_ngn: 3,
      },
      wallet: {
        id: walletData?.id || null,
        available_balance_kobo: walletBalKobo,
        available_balance_ngn: Number((walletBalKobo / 100).toFixed(2)),
        virtual_account: {
          account_number: walletData?.virtual_account_number || null,
          bank_name: walletData?.virtual_bank_name || 'Wema Bank (SeerBit)',
          account_name: walletData?.virtual_account_name || `MyEduRide / ${school.name}`,
        },
      },
      packages,
      summary: {
        total_units_purchased: Number((totalUnitsPurchasedMilli / 1000).toFixed(1)),
        total_units_trial: Number((totalUnitsTrialMilli / 1000).toFixed(1)),
        total_units_consumed: Number((totalUnitsConsumedMilli / 1000).toFixed(1)),
        month_units_consumed: Number((monthUnitsConsumedMilli / 1000).toFixed(1)),
        today_units_consumed: Number((todayUnitsConsumedMilli / 1000).toFixed(1)),
        total_clock_ins: totalClockIns,
        total_clock_outs: totalClockOuts,
        total_purchase_spend_ngn: Number((totalSpentKobo / 100).toFixed(2)),
      },
      ledger: (ledgerRows || []).map((row: any) => ({
        id: row.id,
        entry_type: row.entry_type,
        units_delta: Number((Number(row.units_delta_milli || 0) / 1000).toFixed(1)),
        units_before: Number((Number(row.units_before_milli || 0) / 1000).toFixed(1)),
        units_after: Number((Number(row.units_after_milli || 0) / 1000).toFixed(1)),
        amount_kobo: Number(row.amount_kobo || 0),
        amount_ngn: Number((Number(row.amount_kobo || 0) / 100).toFixed(2)),
        package_id: row.package_id,
        student_id: row.student_id,
        staff_profile_id: row.staff_profile_id,
        person_name: row.person_name,
        person_code: row.person_code,
        person_role: row.person_role,
        scan_type: row.scan_type,
        reference: row.reference,
        description: row.description,
        metadata: row.metadata || {},
        created_at: row.created_at,
      })),
      monthly_reports: (monthlyReports || []).map((r: any) => ({
        id: r.id,
        report_month: r.report_month,
        opening_units: Number((Number(r.opening_units_milli || 0) / 1000).toFixed(1)),
        purchased_units: Number((Number(r.purchased_units_milli || 0) / 1000).toFixed(1)),
        trial_units: Number((Number(r.trial_units_milli || 0) / 1000).toFixed(1)),
        consumed_units: Number((Number(r.consumed_units_milli || 0) / 1000).toFixed(1)),
        closing_units: Number((Number(r.closing_units_milli || 0) / 1000).toFixed(1)),
        total_clock_ins: r.total_clock_ins,
        total_clock_outs: r.total_clock_outs,
        total_amount_ngn: Number((Number(r.total_amount_kobo || 0) / 100).toFixed(2)),
        email_dispatched: r.email_dispatched,
        dispatched_at: r.dispatched_at,
        recipient_emails: r.recipient_emails || [],
        created_at: r.created_at,
      })),
    });
  } catch (err: any) {
    console.error('[api/schools/gate-credits GET]', err);
    return NextResponse.json({ error: err.message || 'Failed to load gate credits' }, { status: 500 });
  }
}

/**
 * POST /api/schools/gate-credits
 * Handles:
 *  - action: 'purchase' -> Deducts payment from school wallet and adds Gate Credit Units immediately
 *  - action: 'claim_free_trial' -> Grants 25 complimentary units for newly onboarded schools
 *  - action: 'send_monthly_report' -> Compiles and sends monthly report via Email & In-App Notification
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { allowed, schoolId } = await resolveAndAuthorizeSchool(session, body.school_id);
    const action = body.action || 'purchase';

    if (!schoolId) {
      return NextResponse.json({ error: 'school_id is required' }, { status: 400 });
    }

    if (!allowed) {
      return NextResponse.json({ error: 'School Admin access required' }, { status: 403 });
    }

    const supabase = getAdminClient();

    if (action === 'claim_free_trial') {
      const { data: rpcResult, error: rpcErr } = await supabase.rpc('claim_school_free_trial_credits', {
        p_school_id: schoolId,
        p_actor_id: session.user_id,
      });

      if (rpcErr) {
        return NextResponse.json({ error: rpcErr.message }, { status: 500 });
      }

      if (!rpcResult?.success) {
        return NextResponse.json(
          { error: rpcResult?.error || 'Unable to claim free trial', details: rpcResult },
          { status: 400 }
        );
      }

      await supabase
        .from('notifications')
        .insert({
          user_id: session.user_id,
          title: '25 Free Trial Gate Credit Units Activated',
          message: `Your school has received 25 complimentary Gate Credit Units. New balance: ${rpcResult.new_units} Units.`,
          type: 'gate_credit_trial',
          is_read: false,
        })
        .then(() => {});

      return NextResponse.json({
        success: true,
        message: '25 Free Trial Gate Credit Units added to your school account!',
        ...rpcResult,
      });
    }

    if (action === 'send_monthly_report') {
      const reportMonth = body.report_month || new Date().toISOString().slice(0, 7);
      const result = await compileAndDispatchMonthlyGateCreditReport({
        schoolId,
        reportMonth,
        sendEmailReport: true,
      });

      return NextResponse.json({
        success: true,
        message: result.emailSent
          ? `Monthly Gate Credit Report (${result.statement.monthLabel}) sent via email and saved to your portal.`
          : `Monthly Gate Credit Report (${result.statement.monthLabel}) generated and published to your portal notifications.`,
        ...result,
      });
    }

    if (action === 'super_admin_adjust') {
      const isSuperAdmin =
        (Array.isArray(session.roles) && session.roles.some((r: any) => r.role === 'super_admin')) ||
        (await supabase
          .from('user_school_roles')
          .select('role')
          .eq('user_id', session.user_id)
          .eq('role', 'super_admin')
          .eq('is_active', true)
          .maybeSingle()
          .then((res) => !!res.data));

      if (!isSuperAdmin) {
        return NextResponse.json({ error: 'Super Admin privileges required for direct unit adjustment' }, { status: 403 });
      }

      const adjustType = body.adjust_type === 'DEBIT' ? 'DEBIT' : 'CREDIT';
      const unitsAmount = Number(body.units || 0);
      const reason = String(body.reason || '').trim() || (adjustType === 'CREDIT' ? 'Super Admin Gate Credit Grant' : 'Super Admin Gate Credit Deduction');

      if (!unitsAmount || unitsAmount <= 0) {
        return NextResponse.json({ error: 'Please enter a valid number of units (> 0)' }, { status: 400 });
      }

      const { data: schoolRow } = await supabase
        .from('schools')
        .select('id, name, gate_credit_balance_milli')
        .eq('id', schoolId)
        .single();

      if (!schoolRow) {
        return NextResponse.json({ error: 'School not found' }, { status: 404 });
      }

      const currentMilli = Number(schoolRow.gate_credit_balance_milli || 0);
      const deltaMilli = Math.round(unitsAmount * 1000) * (adjustType === 'DEBIT' ? -1 : 1);
      const newMilli = Math.max(0, currentMilli + deltaMilli);
      const ref = `GC-ADM-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      await supabase
        .from('schools')
        .update({
          gate_credit_balance_milli: newMilli,
          updated_at: new Date().toISOString(),
        })
        .eq('id', schoolId);

      await supabase.from('school_gate_credit_ledger').insert({
        school_id: schoolId,
        entry_type: adjustType === 'CREDIT' ? 'ADJUSTMENT_CREDIT' : 'ADJUSTMENT_DEBIT',
        units_delta_milli: newMilli - currentMilli,
        units_before_milli: currentMilli,
        units_after_milli: newMilli,
        amount_kobo: Math.round(unitsAmount * 12000),
        reference: ref,
        description: `Super Admin ${adjustType === 'CREDIT' ? 'Credit Grant' : 'Unit Deduction'} (${unitsAmount} Units): ${reason}`,
        actor_user_id: session.user_id,
        metadata: {
          adjust_type: adjustType,
          units: unitsAmount,
          reason,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully ${adjustType === 'CREDIT' ? 'granted' : 'deducted'} ${unitsAmount} Gate Credit Units. New balance: ${(newMilli / 1000).toFixed(1)} Units.`,
        new_units: Number((newMilli / 1000).toFixed(1)),
        reference: ref,
      });
    }

    // Default Action: 'purchase' (Deduct from wallet & credit Gate Units immediately)
    const packageId = body.package_id || null;
    const customUnits = body.custom_units ? Number(body.custom_units) : null;

    const { data: purchaseRes, error: purchaseErr } = await supabase.rpc('purchase_school_gate_credits', {
      p_school_id: schoolId,
      p_package_id: packageId,
      p_actor_id: session.user_id,
      p_custom_units: customUnits,
    });

    if (purchaseErr) {
      console.error('[gate-credits purchase RPC error]', purchaseErr);
      return NextResponse.json({ error: purchaseErr.message }, { status: 500 });
    }

    if (!purchaseRes?.success) {
      return NextResponse.json(
        {
          error: purchaseRes?.error || 'Failed to purchase Gate Credit Units',
          code: purchaseRes?.code || 'purchase_failed',
          available_ngn: purchaseRes?.available_ngn,
          required_ngn: purchaseRes?.required_ngn,
        },
        { status: 400 }
      );
    }

    // Create in-app confirmation notification
    await supabase
      .from('notifications')
      .insert({
        user_id: session.user_id,
        title: `Gate Credit Purchase Successful (+${purchaseRes.units_purchased} Units)`,
        message: `₦${Number(purchaseRes.debited_ngn).toLocaleString()} deducted from your school wallet for ${purchaseRes.units_purchased} Gate Credit Units (${purchaseRes.package_name}). New credit balance: ${purchaseRes.new_units} Units.`,
        type: 'gate_credit_purchase',
        is_read: false,
      })
      .then(() => {});

    return NextResponse.json({
      success: true,
      message: `Successfully purchased ${purchaseRes.units_purchased} Gate Credit Units!`,
      ...purchaseRes,
    });
  } catch (err: any) {
    console.error('[api/schools/gate-credits POST]', err);
    return NextResponse.json({ error: err.message || 'Failed to process gate credit action' }, { status: 500 });
  }
}
