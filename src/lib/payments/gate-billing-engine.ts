/**
 * SCHOOL GATE MANAGER PREPAID CREDIT & BILLING ENGINE
 *
 * Implements the School Gate Credit Unit System:
 * - Strict View Isolation: Gate system ONLY sees remaining Gate Credit Units (never cash wallet balances).
 * - Credit Packages:
 *     25 Units  = ₦3,000
 *     50 Units  = ₦6,000
 *     100 Units = ₦12,000
 *     200 Units = ₦24,000
 *     500 Units = ₦60,000
 *     Custom multiples of 25 Units (@ ₦120 / unit)
 * - Free Trial: 25 Units granted to newly onboarded schools before payment.
 * - Daily Unit Consumption Rule:
 *     1 Complete Unit = ₦6.00 / day = 1 Clock-In (0.5 Unit / ₦3.00) + 1 Clock-Out (0.5 Unit / ₦3.00) per user.
 * - Full Audit Documentation: Every unit purchased or spent is recorded in `school_gate_credit_ledger`.
 */

import { getAdminClient } from '@/lib/supabase/admin';

export interface GateScanEligibilityResult {
  allowed: boolean;
  payerType: 'school' | 'parent' | 'none';
  payerWalletId?: string;
  payerName?: string;
  /** Remaining Gate Credit Units (e.g. 24.5). This is the ONLY balance metric exposed to the gate system. */
  remainingUnits: number;
  remainingUnitsMilli: number;
  requiredUnits: number;
  availableBalanceKobo: number;
  availableBalanceNgn: number;
  scanFeeKobo: number;
  scanFeeNgn: number;
  code?:
    | 'eligible'
    | 'unmetered'
    | 'insufficient_credits'
    | 'insufficient_funds'
    | 'unregistered_student'
    | 'wallet_inactive'
    | 'wallet_not_found';
  message?: string;
}

export interface GateScanDeductionResult {
  success: boolean;
  scanLogId?: string;
  transactionRef?: string;
  payerType: 'school' | 'parent' | 'none';
  payerWalletId?: string;
  scanDirection: 'sign_in' | 'sign_out';
  unitsDeducted: number;
  remainingUnits: number;
  feeKobo: number;
  feeNgn: number;
  newBalanceKobo: number;
  newBalanceNgn: number;
  error?: string;
  code?: string;
}

export interface GateCreditPackage {
  id: string;
  name: string;
  units: number;
  price_kobo: number;
  price_ngn: number;
  daily_equivalent: number;
  description: string;
  badge_text?: string | null;
  display_order: number;
}

export class GateBillingEngine {
  /** 1 Scan (Clock-In or Clock-Out) = 0.5 Unit (500 Milli-Units) = ₦3.00 (300 Kobo) */
  public static readonly DEFAULT_SCAN_FEE_KOBO = 300;
  public static readonly SCAN_COST_MILLI_UNITS = 500; // 0.5 Unit per scan (1.0 Unit = Clock-In + Clock-Out = ₦6/day)
  public static readonly DAILY_UNIT_COST_NGN = 6;
  public static readonly FREE_TRIAL_UNITS = 25;

  /** Minimum School Wallet Deposit: ₦3,000 (minimum package price) */
  public static readonly MIN_SCHOOL_FUNDING_KOBO = 300000;

  /** Standard Monthly Operational Service Charge: 2.0% */
  public static readonly SERVICE_CHARGE_PERCENT = 2.0;

  public static readonly DEFAULT_PACKAGES: GateCreditPackage[] = [
    {
      id: 'PKG_25',
      name: 'Starter Credit Bundle',
      units: 25,
      price_kobo: 300000,
      price_ngn: 3000,
      daily_equivalent: 25,
      description: '25 Gate Credit Units · Covers 50 clock-in/clock-out scans (₦6/day per full unit)',
      badge_text: 'Starter',
      display_order: 1,
    },
    {
      id: 'PKG_50',
      name: 'Standard Growth Bundle',
      units: 50,
      price_kobo: 600000,
      price_ngn: 6000,
      daily_equivalent: 50,
      description: '50 Gate Credit Units · Covers 100 clock-in/clock-out scans across your campus',
      badge_text: 'Most Popular',
      display_order: 2,
    },
    {
      id: 'PKG_100',
      name: 'Institutional Pro Bundle',
      units: 100,
      price_kobo: 1200000,
      price_ngn: 12000,
      daily_equivalent: 100,
      description: '100 Gate Credit Units · Covers 200 clock-in/clock-out scans for growing schools',
      badge_text: 'Best Value',
      display_order: 3,
    },
    {
      id: 'PKG_200',
      name: 'Campus Enterprise Bundle',
      units: 200,
      price_kobo: 2400000,
      price_ngn: 24000,
      daily_equivalent: 200,
      description: '200 Gate Credit Units · High-capacity gate attendance volume for large campuses',
      badge_text: 'Enterprise',
      display_order: 4,
    },
    {
      id: 'PKG_500',
      name: 'Mega Institutional Bundle',
      units: 500,
      price_kobo: 6000000,
      price_ngn: 60000,
      daily_equivalent: 500,
      description: '500 Gate Credit Units · Full-term institutional gate attendance volume',
      badge_text: 'Mega Tier',
      display_order: 5,
    },
  ];

  /**
   * Calculates the 2% monthly service charge on total operational spend.
   */
  public static calculateServiceCharge(totalSpentKobo: number, percent = 2.0): number {
    if (!totalSpentKobo || totalSpentKobo <= 0) return 0;
    return Math.round((totalSpentKobo * percent) / 100);
  }

  /**
   * Strictly sanitized Gate Credit status for the Gate Officer station.
   * Exposes ONLY remaining credit units — zero wallet or bank balance data.
   */
  public static async getGateStationCreditStatus(schoolId: string): Promise<{
    remaining_units: number;
    remaining_scans: number;
    low_threshold_units: number;
    status: 'healthy' | 'low' | 'exhausted';
    daily_unit_rate_ngn: number;
    scan_unit_cost: number;
  }> {
    const supabase = getAdminClient();
    const { data: school } = await supabase
      .from('schools')
      .select('gate_credit_balance_milli, low_credit_threshold_units')
      .eq('id', schoolId)
      .maybeSingle();

    const milli = Number(school?.gate_credit_balance_milli ?? 25000);
    const remainingUnits = Number((milli / 1000).toFixed(1));
    const lowThreshold = Number(school?.low_credit_threshold_units ?? 10);

    let status: 'healthy' | 'low' | 'exhausted' = 'healthy';
    if (milli < this.SCAN_COST_MILLI_UNITS) {
      status = 'exhausted';
    } else if (remainingUnits <= lowThreshold) {
      status = 'low';
    }

    return {
      remaining_units: remainingUnits,
      remaining_scans: Math.floor(milli / this.SCAN_COST_MILLI_UNITS),
      low_threshold_units: lowThreshold,
      status,
      daily_unit_rate_ngn: this.DAILY_UNIT_COST_NGN,
      scan_unit_cost: 0.5,
    };
  }

  /**
   * Validates whether a student or staff gate scan is authorized to proceed
   * based on real-time School Gate Credit Units (0.5 unit per clock-in or clock-out).
   */
  public static async validateGateScanEligibility(params: {
    schoolId: string;
    studentId?: string;
    staffProfileId?: string;
  }): Promise<GateScanEligibilityResult> {
    const { schoolId, studentId } = params;
    const supabase = getAdminClient();

    // 1. Fetch School & Gate Credit Balance
    let school: any = null;
    const { data: schoolData, error: schoolErr } = await supabase
      .from('schools')
      .select('id, name, wallet_mode, is_wallet_active, gate_scan_fee_kobo, gate_credit_balance_milli')
      .eq('id', schoolId)
      .maybeSingle();

    if (!schoolErr && schoolData) {
      school = schoolData;
    } else {
      const { data: baseSchool } = await supabase
        .from('schools')
        .select('id, name')
        .eq('id', schoolId)
        .maybeSingle();

      if (baseSchool) {
        school = {
          ...baseSchool,
          wallet_mode: 'school_funded',
          is_wallet_active: true,
          gate_scan_fee_kobo: this.DEFAULT_SCAN_FEE_KOBO,
          gate_credit_balance_milli: 25000,
        };
      }
    }

    if (!school) {
      return {
        allowed: false,
        payerType: 'school',
        remainingUnits: 0,
        remainingUnitsMilli: 0,
        requiredUnits: 0.5,
        availableBalanceKobo: 0,
        availableBalanceNgn: 0,
        scanFeeKobo: this.DEFAULT_SCAN_FEE_KOBO,
        scanFeeNgn: 3,
        code: 'wallet_not_found',
        message: 'School record not found.',
      };
    }

    const scanFeeKobo = school.gate_scan_fee_kobo || this.DEFAULT_SCAN_FEE_KOBO;
    const scanFeeNgn = scanFeeKobo / 100;
    const walletMode = school.wallet_mode || 'school_funded';
    const creditsMilli = Number(school.gate_credit_balance_milli ?? 0);
    const remainingUnits = Number((creditsMilli / 1000).toFixed(1));

    // 2. Parent-Funded Mode (if specifically set to parent_funded)
    if (walletMode === 'parent_funded' && studentId) {
      const { data: parentLink } = await supabase
        .from('student_parents')
        .select('parent_user_id')
        .eq('student_id', studentId)
        .order('is_primary', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!parentLink?.parent_user_id) {
        return {
          allowed: false,
          payerType: 'parent',
          remainingUnits,
          remainingUnitsMilli: creditsMilli,
          requiredUnits: 0.5,
          availableBalanceKobo: 0,
          availableBalanceNgn: 0,
          scanFeeKobo,
          scanFeeNgn,
          code: 'unregistered_student',
          message:
            'This student is not linked to an active MyEduRide parent account. Only registered students can be signed in/out.',
        };
      }

      const { data: parentWallet } = await supabase
        .from('wallets')
        .select('id, available_balance_kobo, status')
        .eq('user_id', parentLink.parent_user_id)
        .eq('entity_type', 'parent')
        .maybeSingle();

      const balKobo = parentWallet?.available_balance_kobo || 0;
      if (balKobo < scanFeeKobo) {
        return {
          allowed: false,
          payerType: 'parent',
          payerWalletId: parentWallet?.id,
          remainingUnits,
          remainingUnitsMilli: creditsMilli,
          requiredUnits: 0.5,
          availableBalanceKobo: balKobo,
          availableBalanceNgn: balKobo / 100,
          scanFeeKobo,
          scanFeeNgn,
          code: 'insufficient_funds',
          message: 'Parent account has insufficient gate transit credits.',
        };
      }

      return {
        allowed: true,
        payerType: 'parent',
        payerWalletId: parentWallet?.id,
        remainingUnits,
        remainingUnitsMilli: creditsMilli,
        requiredUnits: 0.5,
        availableBalanceKobo: 0,
        availableBalanceNgn: 0,
        scanFeeKobo,
        scanFeeNgn,
        code: 'eligible',
      };
    }

    // 3. School Gate Credit System (Default)
    // Requires at least 0.5 Unit (500 milli-units) per Clock-In or Clock-Out scan
    if (creditsMilli < this.SCAN_COST_MILLI_UNITS) {
      return {
        allowed: false,
        payerType: 'school',
        payerName: school.name,
        remainingUnits,
        remainingUnitsMilli: creditsMilli,
        requiredUnits: 0.5,
        availableBalanceKobo: 0,
        availableBalanceNgn: 0,
        scanFeeKobo,
        scanFeeNgn,
        code: 'insufficient_credits',
        message: `Gate Credit Units exhausted (${remainingUnits.toFixed(1)} Units remaining). Please contact School Admin to purchase Gate Credit Units.`,
      };
    }

    return {
      allowed: true,
      payerType: 'school',
      payerName: school.name,
      remainingUnits,
      remainingUnitsMilli: creditsMilli,
      requiredUnits: 0.5,
      availableBalanceKobo: 0,
      availableBalanceNgn: 0,
      scanFeeKobo,
      scanFeeNgn,
      code: 'eligible',
    };
  }

  /**
   * Executes atomic 0.5 Gate Credit Unit (₦3.00 equivalent) deduction per Clock-In / Clock-Out scan
   * and logs the transaction in `school_gate_credit_ledger`.
   */
  public static async executeGateScanDeduction(params: {
    schoolId: string;
    studentId?: string;
    staffProfileId?: string;
    scanDirection: 'sign_in' | 'sign_out';
  }): Promise<GateScanDeductionResult> {
    const { schoolId, studentId, staffProfileId, scanDirection } = params;
    const supabase = getAdminClient();

    // 1. Atomic PostgreSQL Stored Procedure Execution
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('deduct_gate_scan_fee', {
        p_school_id: schoolId,
        p_student_id: studentId || null,
        p_staff_profile_id: staffProfileId || null,
        p_scan_direction: scanDirection,
      });

      if (!rpcErr && rpcData) {
        if (!rpcData.success) {
          return {
            success: false,
            payerType: rpcData.payer_type || 'school',
            scanDirection,
            unitsDeducted: 0,
            remainingUnits: Number(rpcData.remaining_units ?? 0),
            feeKobo: rpcData.required_kobo || this.DEFAULT_SCAN_FEE_KOBO,
            feeNgn: (rpcData.required_kobo || this.DEFAULT_SCAN_FEE_KOBO) / 100,
            newBalanceKobo: 0,
            newBalanceNgn: 0,
            error: rpcData.message || rpcData.error,
            code: rpcData.code || 'insufficient_credits',
          };
        }

        return {
          success: true,
          scanLogId: rpcData.scan_log_id,
          transactionRef: rpcData.reference,
          payerType: rpcData.payer_type || 'school',
          scanDirection,
          unitsDeducted: Number(rpcData.units_deducted ?? 0.5),
          remainingUnits: Number(rpcData.remaining_units ?? 0),
          feeKobo: rpcData.fee_kobo || this.DEFAULT_SCAN_FEE_KOBO,
          feeNgn: (rpcData.fee_kobo || this.DEFAULT_SCAN_FEE_KOBO) / 100,
          newBalanceKobo: 0,
          newBalanceNgn: 0,
        };
      }
    } catch (procErr) {
      console.warn('[GateBillingEngine] Stored procedure fallback triggered:', procErr);
    }

    // 2. Resilient Direct Fallback: Deduct 500 milli-units (0.5 unit) directly and document in ledger
    const eligibility = await this.validateGateScanEligibility({ schoolId, studentId, staffProfileId });
    if (!eligibility.allowed) {
      return {
        success: false,
        payerType: eligibility.payerType,
        scanDirection,
        unitsDeducted: 0,
        remainingUnits: eligibility.remainingUnits,
        feeKobo: eligibility.scanFeeKobo,
        feeNgn: eligibility.scanFeeNgn,
        newBalanceKobo: 0,
        newBalanceNgn: 0,
        error: eligibility.message,
        code: eligibility.code,
      };
    }

    const newMilli = Math.max(0, eligibility.remainingUnitsMilli - this.SCAN_COST_MILLI_UNITS);
    const newUnits = Number((newMilli / 1000).toFixed(1));
    const ref = `GC-SCAN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const scanTypeLabel = scanDirection === 'sign_out' ? 'clock_out' : 'clock_in';

    // Resolve person name for ledger documentation
    let personName = 'Campus Member';
    let personCode = '';
    let personRole = studentId ? 'student' : 'staff';

    if (studentId) {
      const { data: st } = await supabase
        .from('students')
        .select('first_name, last_name, student_id_number')
        .eq('id', studentId)
        .maybeSingle();
      if (st) {
        personName = `${st.first_name || ''} ${st.last_name || ''}`.trim();
        personCode = st.student_id_number || '';
      }
    } else if (staffProfileId) {
      const { data: tp } = await supabase
        .from('teacher_profiles')
        .select('staff_id_number, user:user_profiles(full_name)')
        .eq('id', staffProfileId)
        .maybeSingle();
      if (tp) {
        const u: any = Array.isArray(tp.user) ? tp.user[0] : tp.user;
        personName = u?.full_name || 'Staff Member';
        personCode = tp.staff_id_number || '';
      }
    }

    await supabase
      .from('schools')
      .update({ gate_credit_balance_milli: newMilli, updated_at: new Date().toISOString() })
      .eq('id', schoolId);

    await supabase.from('school_gate_credit_ledger').insert({
      school_id: schoolId,
      entry_type: 'CONSUMPTION_SCAN',
      units_delta_milli: -this.SCAN_COST_MILLI_UNITS,
      units_before_milli: eligibility.remainingUnitsMilli,
      units_after_milli: newMilli,
      amount_kobo: this.DEFAULT_SCAN_FEE_KOBO,
      student_id: studentId || null,
      staff_profile_id: staffProfileId || null,
      person_name: personName,
      person_code: personCode,
      person_role: personRole,
      scan_type: scanTypeLabel,
      reference: ref,
      description: `${scanDirection === 'sign_in' ? 'Clock-In' : 'Clock-Out'} Scan: ${personName} (${personCode || personRole.toUpperCase()}) · -0.5 Unit (₦3)`,
      metadata: {
        scan_direction: scanDirection,
        scan_type: scanTypeLabel,
        person_name: personName,
        person_code: personCode,
        person_role: personRole,
        unit_cost_ngn: 3,
        daily_unit_rate_ngn: 6,
      },
    });

    const { data: logData } = await supabase
      .from('gate_scan_logs')
      .insert({
        school_id: schoolId,
        student_id: studentId || null,
        staff_profile_id: staffProfileId || null,
        scan_direction: scanDirection,
        scan_fee_kobo: this.DEFAULT_SCAN_FEE_KOBO,
        payer_type: 'school',
        status: 'BILLED',
        transaction_ref: ref,
      })
      .select('id')
      .maybeSingle();

    return {
      success: true,
      scanLogId: logData?.id,
      transactionRef: ref,
      payerType: 'school',
      scanDirection,
      unitsDeducted: 0.5,
      remainingUnits: newUnits,
      feeKobo: this.DEFAULT_SCAN_FEE_KOBO,
      feeNgn: 3,
      newBalanceKobo: 0,
      newBalanceNgn: 0,
    };
  }
}
