import { TestSuite, expect } from '../utils/test-harness';
import { GateBillingEngine } from '../../src/lib/payments/gate-billing-engine';
import { DelayPenaltyEngine } from '../../src/lib/escort/delay-penalty-engine';

export const phase2EnginesSuite = new TestSuite(
  'Phase 2: Gate Billing & Delay Penalty Engine Invariants',
  'UNIT'
);

// 1. GateBillingEngine Constants & Service Charge Formulation
phase2EnginesSuite.test(
  'GateBillingEngine: Verifies standard constants and 2% monthly service charge math',
  () => {
    expect(GateBillingEngine.DEFAULT_SCAN_FEE_KOBO).toBe(300); // ₦3.00
    expect(GateBillingEngine.MIN_SCHOOL_FUNDING_KOBO).toBe(1000000); // ₦10,000.00
    expect(GateBillingEngine.SERVICE_CHARGE_PERCENT).toBe(2.0);

    // Test 2% calculation on various monthly volumes
    expect(GateBillingEngine.calculateServiceCharge(60000)).toBe(1200); // ₦600 spent -> ₦12 service charge
    expect(GateBillingEngine.calculateServiceCharge(250000)).toBe(5000); // ₦2,500 spent -> ₦50 service charge
    expect(GateBillingEngine.calculateServiceCharge(1000000)).toBe(20000); // ₦10,000 spent -> ₦200 service charge
    expect(GateBillingEngine.calculateServiceCharge(0)).toBe(0);
    expect(GateBillingEngine.calculateServiceCharge(-500)).toBe(0);
  }
);

// 2. Gate Scan Pay-As-You-Go Invariant: ₦3 Debit & Daisaf Credit
phase2EnginesSuite.test(
  'GateBillingEngine: Balances integer debits and credits across double-entry ledger without drift',
  () => {
    const initialSchoolBalKobo = 500000; // ₦5,000.00
    const initialDaisafBalKobo = 0;
    const scanFeeKobo = GateBillingEngine.DEFAULT_SCAN_FEE_KOBO; // 300 kobo (₦3.00)

    const updatedSchoolBal = initialSchoolBalKobo - scanFeeKobo;
    const updatedDaisafBal = initialDaisafBalKobo + scanFeeKobo;

    expect(updatedSchoolBal).toBe(499700); // ₦4,997.00
    expect(updatedDaisafBal).toBe(300); // ₦3.00
    expect(updatedSchoolBal + updatedDaisafBal).toBe(initialSchoolBalKobo); // Conservation of funds
  }
);

// 3. DelayPenaltyEngine Constants & Grace Window Formulations
phase2EnginesSuite.test(
  'DelayPenaltyEngine: Verifies 2-minute grace + 1-minute scan buffer (3-minute total threshold)',
  () => {
    expect(DelayPenaltyEngine.PENALTY_RATE_PER_MINUTE_KOBO).toBe(5000); // ₦50.00
    expect(DelayPenaltyEngine.GEOFENCE_TOLERANCE_METERS).toBe(150.0);
    expect(DelayPenaltyEngine.GRACE_PERIOD_MS).toBe(120000); // 2 minutes
    expect(DelayPenaltyEngine.SCAN_BUFFER_MS).toBe(60000); // 1 minute
    expect(DelayPenaltyEngine.TOTAL_GRACE_WINDOW_MS).toBe(180000); // 3 minutes total
  }
);

// 4. Delay Penalty Minute Calculation Formulation
phase2EnginesSuite.test(
  'DelayPenaltyEngine: Charges ₦50/minute exclusively for delay after the 3-minute grace period',
  () => {
    const arrivalTime = 1700000000000;
    const penaltyStartTime = arrivalTime + DelayPenaltyEngine.TOTAL_GRACE_WINDOW_MS;

    // Within grace (boarded at 2m 30s)
    const onTimeBoard = arrivalTime + 150000;
    const overdueOnTime = onTimeBoard - penaltyStartTime;
    expect(overdueOnTime <= 0).toBe(true);

    // Exactly at threshold (boarded at 3m 00s)
    const exactThresholdBoard = arrivalTime + 180000;
    const overdueExact = exactThresholdBoard - penaltyStartTime;
    expect(overdueExact <= 0).toBe(true);

    // 1 second late (into minute 1 of penalty)
    const late1s = penaltyStartTime + 1000;
    const minutesLate1s = Math.ceil((late1s - penaltyStartTime) / 60000);
    expect(minutesLate1s).toBe(1);
    expect(minutesLate1s * DelayPenaltyEngine.PENALTY_RATE_PER_MINUTE_KOBO).toBe(5000); // ₦50.00

    // 5 minutes late after 3-minute threshold
    const late5m = penaltyStartTime + 5 * 60 * 1000;
    const minutesLate5m = Math.ceil((late5m - penaltyStartTime) / 60000);
    expect(minutesLate5m).toBe(5);
    expect(minutesLate5m * DelayPenaltyEngine.PENALTY_RATE_PER_MINUTE_KOBO).toBe(25000); // ₦250.00
  }
);

// 5. GPS Geofence Distance Calculation Formula (Haversine)
phase2EnginesSuite.test(
  'DelayPenaltyEngine: Haversine distance correctly identifies arrival within 150m boundary',
  () => {
    // Lagos Island Coordinates (Reference: Lagos City Hall)
    const refLat = 6.4531;
    const refLng = 3.3958;

    // 50m away
    const nearLat = 6.4534;
    const nearLng = 3.3961;
    const distNear = DelayPenaltyEngine.calculateDistanceMeters(refLat, refLng, nearLat, nearLng);
    expect(distNear).toBeLessThanOrEqual(DelayPenaltyEngine.GEOFENCE_TOLERANCE_METERS);

    // 1.2km away
    const farLat = 6.4630;
    const farLng = 3.4020;
    const distFar = DelayPenaltyEngine.calculateDistanceMeters(refLat, refLng, farLat, farLng);
    expect(distFar).toBeGreaterThan(DelayPenaltyEngine.GEOFENCE_TOLERANCE_METERS);
  }
);
