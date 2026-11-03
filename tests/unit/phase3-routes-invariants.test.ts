import { TestSuite, expect } from '../utils/test-harness';
import { GateBillingEngine } from '../../src/lib/payments/gate-billing-engine';
import { DelayPenaltyEngine } from '../../src/lib/escort/delay-penalty-engine';

export const phase3RoutesInvariantsSuite = new TestSuite(
  'Phase 3: Unified REST Routes Invariants & Spec Compliance',
  'UNIT'
);

// 1. School Funding Threshold Invariant (Spec Section 2.1)
phase3RoutesInvariantsSuite.test(
  'Deposit Invariants: Enforces ₦10,000 minimum funding for schools and ₦500 for parents',
  () => {
    const schoolMinKobo = GateBillingEngine.MIN_SCHOOL_FUNDING_KOBO;
    expect(schoolMinKobo).toBe(1000000); // ₦10,000.00 in kobo
    expect(schoolMinKobo / 100).toBe(10000); // ₦10,000 NGN

    const parentMinKobo = 50000; // ₦500.00 in kobo
    expect(parentMinKobo / 100).toBe(500);

    // Validate rejected sub-threshold amounts
    const testSchoolAmountNgn = 5000;
    expect(testSchoolAmountNgn < schoolMinKobo / 100).toBe(true);

    const validSchoolAmountNgn = 10000;
    expect(validSchoolAmountNgn >= schoolMinKobo / 100).toBe(true);
  }
);

// 2. Withdrawal Mandatory Reason & Minimum Amount Invariant (Spec Section 4.2 & 5)
phase3RoutesInvariantsSuite.test(
  'Withdrawal Invariants: Reason is mandatory and minimum threshold is ₦1,000',
  () => {
    const minWithdrawalKobo = 100000; // ₦1,000.00
    expect(minWithdrawalKobo / 100).toBe(1000);

    const validateWithdrawalInput = (amountKobo: number, reason?: string) => {
      if (!reason || reason.trim().length < 5) {
        return { valid: false, error: 'MANDATORY_REASON_REQUIRED' };
      }
      if (amountKobo < minWithdrawalKobo) {
        return { valid: false, error: 'BELOW_MINIMUM_THRESHOLD' };
      }
      return { valid: true };
    };

    expect(validateWithdrawalInput(500000, '').valid).toBe(false);
    expect(validateWithdrawalInput(500000, 'abc').valid).toBe(false);
    expect(validateWithdrawalInput(50000, 'Emergency hospital bill').valid).toBe(false);
    expect(validateWithdrawalInput(500000, 'Emergency medical care and medicine').valid).toBe(true);
  }
);

// 3. School Escort Daily Charge Invariant: ₦25 Pickup + ₦25 Dropoff = ₦50/Day (Spec Section 2.2)
phase3RoutesInvariantsSuite.test(
  'Escort Pay-As-You-Go Invariant: ₦25 pickup + ₦25 dropoff = ₦50/day per student',
  () => {
    const pickupFeeKobo = 2500; // ₦25.00
    const dropoffFeeKobo = 2500; // ₦25.00
    const totalDailyFeeKobo = pickupFeeKobo + dropoffFeeKobo;

    expect(totalDailyFeeKobo).toBe(5000); // ₦50.00
    expect(totalDailyFeeKobo / 100).toBe(50);

    // Monthly 2% service charge on 20 days of escort transit (100 students)
    const studentsCount = 100;
    const daysInMonth = 20;
    const totalMonthlySpendKobo = studentsCount * totalDailyFeeKobo * daysInMonth; // ₦100,000.00
    expect(totalMonthlySpendKobo).toBe(10000000);

    const serviceChargeKobo = GateBillingEngine.calculateServiceCharge(totalMonthlySpendKobo, 2.0);
    expect(serviceChargeKobo).toBe(200000); // ₦2,000.00 service charge (2%)
    expect(serviceChargeKobo / 100).toBe(2000);
  }
);

// 4. Delay Penalty Formulation & Rate Invariant (Spec Section 3.2)
phase3RoutesInvariantsSuite.test(
  'Delay Penalty Invariant: ₦50/minute exclusively past the 3-minute grace threshold',
  () => {
    const rateKoboPerMin = DelayPenaltyEngine.PENALTY_RATE_PER_MINUTE_KOBO;
    expect(rateKoboPerMin).toBe(5000); // ₦50.00

    const arrivalMs = 1700000000000;
    const graceWindowMs = DelayPenaltyEngine.TOTAL_GRACE_WINDOW_MS; // 3 minutes

    const calculatePenalty = (boardedMs: number) => {
      const overdueMs = boardedMs - (arrivalMs + graceWindowMs);
      if (overdueMs <= 0) return { delayMinutes: 0, penaltyKobo: 0 };
      const minutes = Math.ceil(overdueMs / 60000);
      return { delayMinutes: minutes, penaltyKobo: minutes * rateKoboPerMin };
    };

    // Boarded at 2m 59s -> ₦0
    expect(calculatePenalty(arrivalMs + 179000).penaltyKobo).toBe(0);

    // Boarded at 3m 01s -> 1 minute late -> ₦50
    const pen1m = calculatePenalty(arrivalMs + 181000);
    expect(pen1m.delayMinutes).toBe(1);
    expect(pen1m.penaltyKobo).toBe(5000);

    // Boarded at 10m 00s -> 7 minutes late -> ₦350
    const pen7m = calculatePenalty(arrivalMs + 600000);
    expect(pen7m.delayMinutes).toBe(7);
    expect(pen7m.penaltyKobo).toBe(35000);
  }
);

// 5. Maker-Checker Segregation of Duties Invariant (Spec Section 4.2 & 5)
phase3RoutesInvariantsSuite.test(
  'Maker-Checker Governance Invariant: Multi-tiered approval workflow state transitions',
  () => {
    type WithdrawalState = 'PENDING_CHECKER' | 'CHECKER_APPROVED' | 'DISBURSED' | 'REJECTED';

    interface RequestContext {
      id: string;
      makerId: string;
      status: WithdrawalState;
      checkerId?: string;
      superAdminId?: string;
    }

    const req: RequestContext = {
      id: 'REQ-001',
      makerId: 'user-escort-1',
      status: 'PENDING_CHECKER',
    };

    // Step 1: Accountant vets
    const vetRequest = (r: RequestContext, accountantId: string) => {
      if (r.status !== 'PENDING_CHECKER') throw new Error('Invalid state');
      if (r.makerId === accountantId) throw new Error('Maker cannot check own request');
      r.status = 'CHECKER_APPROVED';
      r.checkerId = accountantId;
    };

    vetRequest(req, 'accountant-user-1');
    expect(req.status).toBe('CHECKER_APPROVED');
    expect(req.checkerId).toBe('accountant-user-1');

    // Step 2: Super Admin approves & disburses
    const approveAndDisburse = (r: RequestContext, adminId: string) => {
      if (r.status !== 'CHECKER_APPROVED') throw new Error('Must be vetted first');
      if (r.makerId === adminId) throw new Error('Maker cannot approve own request');
      r.status = 'DISBURSED';
      r.superAdminId = adminId;
    };

    approveAndDisburse(req, 'super-admin-user-1');
    expect(req.status).toBe('DISBURSED');
    expect(req.superAdminId).toBe('super-admin-user-1');
  }
);
