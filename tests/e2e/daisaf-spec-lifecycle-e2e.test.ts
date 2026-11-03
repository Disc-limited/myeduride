import { TestSuite, expect } from '../utils/test-harness';
import { GateBillingEngine } from '../../src/lib/payments/gate-billing-engine';
import { DelayPenaltyEngine } from '../../src/lib/escort/delay-penalty-engine';

export const daisafSpecLifecycleE2ESuite = new TestSuite(
  'Daisaf Specification Full Lifecycle E2E Simulation',
  'E2E'
);

daisafSpecLifecycleE2ESuite.test(
  'E2E Simulation: School Minimum Funding ➔ Gate Scans (₦3) ➔ Escort Arrival & Geofence ➔ 3-Min Grace & Delay Penalty (₦50/min) ➔ Pickup & Dropoff (₦25 each) ➔ Evening Escrow Settlement ➔ Maker-Checker Withdrawal',
  async () => {
    // -------------------------------------------------------------------------
    // 1. School Admin Wallet Funding (Minimum ₦10,000)
    // -------------------------------------------------------------------------
    const schoolWallet = {
      id: 'WAL-SCH-GREENWOOD',
      schoolId: 'SCH-GREENWOOD',
      availableBalanceKobo: 0,
      escrowBalanceKobo: 0,
      reservedBalanceKobo: 0,
    };

    const daisafRevenueWallet = {
      id: 'WAL-DAISAF-PRIMARY',
      availableBalanceKobo: 0,
    };

    const fundingAmountNgn = 10000; // ₦10,000
    const fundingAmountKobo = fundingAmountNgn * 100; // 1,000,000 kobo
    expect(fundingAmountKobo >= GateBillingEngine.MIN_SCHOOL_FUNDING_KOBO).toBe(true);

    schoolWallet.availableBalanceKobo += fundingAmountKobo;
    expect(schoolWallet.availableBalanceKobo).toBe(1000000); // ₦10,000.00

    // -------------------------------------------------------------------------
    // 2. Gate Manager: 100 Sign-In Scans & 100 Sign-Out Scans (@ ₦3/scan)
    // -------------------------------------------------------------------------
    const scanFeeKobo = GateBillingEngine.DEFAULT_SCAN_FEE_KOBO; // 300 kobo = ₦3.00
    const totalScans = 200; // 100 in, 100 out
    const totalScanFeesKobo = totalScans * scanFeeKobo; // 60,000 kobo = ₦600.00

    schoolWallet.availableBalanceKobo -= totalScanFeesKobo;
    daisafRevenueWallet.availableBalanceKobo += totalScanFeesKobo;

    expect(schoolWallet.availableBalanceKobo).toBe(940000); // ₦9,400.00 remaining
    expect(daisafRevenueWallet.availableBalanceKobo).toBe(60000); // ₦600.00 revenue
    expect(schoolWallet.availableBalanceKobo + daisafRevenueWallet.availableBalanceKobo).toBe(1000000);

    // -------------------------------------------------------------------------
    // 3. Parent Wallet Setup for Direct Payer Escort Transit
    // -------------------------------------------------------------------------
    const parentWallet = {
      id: 'WAL-PAR-CHIDI',
      userId: 'USR-PAR-CHIDI',
      availableBalanceKobo: 500000, // ₦5,000.00
      escrowBalanceKobo: 0,
      reservedBalanceKobo: 0,
    };

    // -------------------------------------------------------------------------
    // 4. Escort Arrival: "I Am Here for Pickup" with Geofence & Balance Pre-Check
    // -------------------------------------------------------------------------
    const studentHomeLat = 6.4531;
    const studentHomeLng = 3.3958;
    const escortCurrentLat = 6.4533; // ~40m away
    const escortCurrentLng = 3.3961;

    const distanceMeters = DelayPenaltyEngine.calculateDistanceMeters(
      escortCurrentLat,
      escortCurrentLng,
      studentHomeLat,
      studentHomeLng
    );
    expect(distanceMeters <= DelayPenaltyEngine.GEOFENCE_TOLERANCE_METERS).toBe(true);

    // Pre-check parent wallet balance
    const requiredPickupFeeKobo = 2500; // ₦25.00
    expect(parentWallet.availableBalanceKobo >= requiredPickupFeeKobo).toBe(true);

    const arrivalTimestamp = 1700000000000;
    const graceExpiresAt = arrivalTimestamp + DelayPenaltyEngine.GRACE_PERIOD_MS; // +2 mins
    const penaltyStartsAt = arrivalTimestamp + DelayPenaltyEngine.TOTAL_GRACE_WINDOW_MS; // +3 mins (2 min grace + 1 min scan)

    expect(graceExpiresAt - arrivalTimestamp).toBe(120000);
    expect(penaltyStartsAt - arrivalTimestamp).toBe(180000);

    // -------------------------------------------------------------------------
    // 5. Delay Penalty: Student Boarded 7 Minutes After Arrival (4 Minutes Late)
    // -------------------------------------------------------------------------
    const boardedTimestamp = arrivalTimestamp + 7 * 60 * 1000; // 7 minutes after arrival
    const overdueMs = boardedTimestamp - penaltyStartsAt; // 4 minutes past 3-minute threshold
    expect(overdueMs).toBe(240000); // 4 minutes

    const delayMinutes = Math.ceil(overdueMs / 60000);
    expect(delayMinutes).toBe(4);

    const delayPenaltyKobo = delayMinutes * DelayPenaltyEngine.PENALTY_RATE_PER_MINUTE_KOBO; // 4 * 5,000 = 20,000 kobo = ₦200.00
    expect(delayPenaltyKobo).toBe(20000);

    // Lock delay penalty from parent available balance into parent escrow
    parentWallet.availableBalanceKobo -= delayPenaltyKobo;
    parentWallet.escrowBalanceKobo += delayPenaltyKobo;
    expect(parentWallet.availableBalanceKobo).toBe(480000); // ₦4,800.00
    expect(parentWallet.escrowBalanceKobo).toBe(20000); // ₦200.00 in escrow

    // -------------------------------------------------------------------------
    // 6. Morning Pickup Boarding: ₦25 Deduction into Escrow
    // -------------------------------------------------------------------------
    const pickupFeeKobo = 2500; // ₦25.00
    parentWallet.availableBalanceKobo -= pickupFeeKobo;
    parentWallet.escrowBalanceKobo += pickupFeeKobo;

    expect(parentWallet.availableBalanceKobo).toBe(477500); // ₦4,775.00
    expect(parentWallet.escrowBalanceKobo).toBe(22500); // ₦225.00 in escrow

    // -------------------------------------------------------------------------
    // 7. Afternoon Safe Drop-Off: ₦25 Deduction into Escrow
    // -------------------------------------------------------------------------
    const dropoffFeeKobo = 2500; // ₦25.00
    parentWallet.availableBalanceKobo -= dropoffFeeKobo;
    parentWallet.escrowBalanceKobo += dropoffFeeKobo;

    expect(parentWallet.availableBalanceKobo).toBe(475000); // ₦4,750.00
    expect(parentWallet.escrowBalanceKobo).toBe(25000); // ₦250.00 total escrow (₦50 trip + ₦200 delay)

    // -------------------------------------------------------------------------
    // 8. 7:00 PM Evening Escrow Settlement: Release Funds to Escort Wallet
    // -------------------------------------------------------------------------
    const escortWallet = {
      id: 'WAL-ESC-ADEYEMI',
      userId: 'USR-ESC-ADEYEMI',
      availableBalanceKobo: 0,
    };

    // Both legs complete: Escrow releases funds to Escort available balance
    const escrowReleaseKobo = parentWallet.escrowBalanceKobo;
    parentWallet.escrowBalanceKobo = 0;
    escortWallet.availableBalanceKobo += escrowReleaseKobo;

    expect(parentWallet.escrowBalanceKobo).toBe(0);
    expect(escortWallet.availableBalanceKobo).toBe(25000); // ₦250.00 credited to escort

    // -------------------------------------------------------------------------
    // 9. Emergency Escort Withdrawal with Maker-Checker Compliance
    // -------------------------------------------------------------------------
    const withdrawalAmountKobo = 20000; // ₦200.00
    const withdrawalReason = 'Emergency medical prescription for child';
    expect(withdrawalReason.length >= 5).toBe(true);

    // Maker initiates withdrawal request
    const withdrawalRequest = {
      id: 'WITHDRAW-0099',
      makerUserId: escortWallet.userId,
      amountKobo: withdrawalAmountKobo,
      reason: withdrawalReason,
      status: 'PENDING_CHECKER',
      checkerUserId: null as string | null,
      superAdminUserId: null as string | null,
    };

    // Escort available balance reserved
    escortWallet.availableBalanceKobo -= withdrawalAmountKobo;
    expect(escortWallet.availableBalanceKobo).toBe(5000); // ₦50.00 remaining

    // Step 1: Accountant vets request
    const accountantUserId = 'USR-ACCT-01';
    expect(accountantUserId !== withdrawalRequest.makerUserId).toBe(true); // Segregation of duties
    withdrawalRequest.status = 'CHECKER_APPROVED';
    withdrawalRequest.checkerUserId = accountantUserId;
    expect(withdrawalRequest.status).toBe('CHECKER_APPROVED');

    // Step 2: Super Admin approves & executes disbursement
    const superAdminUserId = 'USR-SUPERADMIN-01';
    expect(superAdminUserId !== withdrawalRequest.makerUserId).toBe(true);
    withdrawalRequest.status = 'DISBURSED';
    withdrawalRequest.superAdminUserId = superAdminUserId;
    expect(withdrawalRequest.status).toBe('DISBURSED');

    // -------------------------------------------------------------------------
    // 10. Conservation of Total Financial Invariant
    // -------------------------------------------------------------------------
    const finalSystemSumKobo =
      schoolWallet.availableBalanceKobo +
      daisafRevenueWallet.availableBalanceKobo +
      parentWallet.availableBalanceKobo +
      parentWallet.escrowBalanceKobo +
      escortWallet.availableBalanceKobo +
      withdrawalRequest.amountKobo;

    const initialSystemSumKobo = 1000000 + 500000; // School ₦10,000 + Parent ₦5,000
    expect(finalSystemSumKobo).toBe(initialSystemSumKobo); // Zero-loss mathematical invariant preserved!
  }
);
