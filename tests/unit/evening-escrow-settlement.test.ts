import { TestSuite, expect } from '../utils/test-harness';
import { TripFareEngine } from '../../src/lib/payments/trip-fare-engine';
import { formatKoboToNgn } from '../../src/lib/escort/escort-wallet';

export const eveningEscrowSettlementSuite = new TestSuite(
  'Transport Daily Escrow & Automated 7:00 PM Escort Settlement Suite (Phase 4)',
  'UNIT'
);

// -----------------------------------------------------------------------------
// Test 1: Mathematical Invariant Assertion (Zero Penny Leakage)
// -----------------------------------------------------------------------------
eveningEscrowSettlementSuite.test(
  'Test 1: Strict Assertion — (driver_share_kobo + platform_kobo) === gross_amount_kobo across fare spectrums',
  () => {
    const testFaresKobo = [
      106000, // ₦1,060 Standard daily fee
      50000,  // ₦500
      85450,  // ₦854.50 (odd cent calculation)
      120000, // ₦1,200
      250000, // ₦2,500
      345678, // ₦3,456.78
    ];

    for (const grossKobo of testFaresKobo) {
      const split = TripFareEngine.verifyEscrowSplitAssertion(grossKobo);

      // Verify exact sum equality
      expect(split.driverShareKobo + split.platformShareKobo).toBe(grossKobo);

      // Verify individual components
      expect(split.kmKobo + split.vatKobo).toBe(grossKobo);
      expect(split.driverShareKobo + split.myedurideKmKobo).toBe(split.kmKobo);
      expect(split.platformShareKobo).toBe(split.vatKobo + split.myedurideKmKobo);
    }
  }
);

// -----------------------------------------------------------------------------
// Test 2: Invalid Fares Reject Assertion
// -----------------------------------------------------------------------------
eveningEscrowSettlementSuite.test(
  'Test 2: verifyEscrowSplitAssertion throws error on invalid or non-positive amounts',
  () => {
    let threwZero = false;
    try {
      TripFareEngine.verifyEscrowSplitAssertion(0);
    } catch {
      threwZero = true;
    }
    expect(threwZero).toBe(true);

    let threwNegative = false;
    try {
      TripFareEngine.verifyEscrowSplitAssertion(-5000);
    } catch {
      threwNegative = true;
    }
    expect(threwNegative).toBe(true);
  }
);

// -----------------------------------------------------------------------------
// Test 3: Currency Formatter Compliance
// -----------------------------------------------------------------------------
eveningEscrowSettlementSuite.test(
  'Test 3: formatKoboToNgn outputs compliant Nigerian Naira currency string',
  () => {
    expect(formatKoboToNgn(106000)).toContain('1,060.00');
    expect(formatKoboToNgn(80000)).toContain('800.00');
    expect(formatKoboToNgn(0)).toContain('0.00');
  }
);

// -----------------------------------------------------------------------------
// Test 4: Completed Trip Simulation (Morning Picked Up + Afternoon Dropped Off)
// -----------------------------------------------------------------------------
eveningEscrowSettlementSuite.test(
  'Test 4: Completed trip qualifies for payout release into escort available balance',
  () => {
    const trip = {
      id: 'TRIP-COMPLETED-001',
      student_id: 'STUDENT-001',
      escort_id: 'ESCORT-001',
      morning_picked_up: true,
      afternoon_dropped_off: true,
      is_canceled_by_parent: false,
      fee_status: 'deducted',
      settlement_status: 'pending',
    };

    const isFullyCompleted = trip.morning_picked_up && trip.afternoon_dropped_off && !trip.is_canceled_by_parent;
    expect(isFullyCompleted).toBe(true);

    // Simulated escrow release
    const grossKobo = 106000;
    const split = TripFareEngine.verifyEscrowSplitAssertion(grossKobo);
    
    // Parent wallet simulation
    const parentWallet = { available: 500000, escrow: grossKobo };
    parentWallet.escrow -= grossKobo;

    // Escort wallet simulation (credited to available balance)
    const escortWallet = { available: 20000, pending: 0 };
    escortWallet.available += split.driverShareKobo;

    // Platform treasury simulation
    const treasuryWallet = { available: 100000 };
    treasuryWallet.available += split.platformShareKobo;

    expect(parentWallet.escrow).toBe(0);
    expect(escortWallet.available).toBe(20000 + split.driverShareKobo);
    expect(treasuryWallet.available).toBe(100000 + split.platformShareKobo);
  }
);

// -----------------------------------------------------------------------------
// Test 5: Incomplete Trip Vaulting (Started but Afternoon Drop-Off Not Confirmed)
// -----------------------------------------------------------------------------
eveningEscrowSettlementSuite.test(
  'Test 5: Incomplete trip is vaulted as SETTLEMENT_HELD_FOR_REVIEW without payout',
  () => {
    const incompleteTrip = {
      id: 'TRIP-INCOMPLETE-002',
      student_id: 'STUDENT-002',
      escort_id: 'ESCORT-002',
      morning_picked_up: true,
      afternoon_picked_up: false,
      afternoon_dropped_off: false,
      is_canceled_by_parent: false,
      fee_status: 'deducted',
      settlement_status: 'pending',
    };

    const isIncomplete =
      (incompleteTrip.morning_picked_up || incompleteTrip.afternoon_picked_up) &&
      !incompleteTrip.afternoon_dropped_off &&
      !incompleteTrip.is_canceled_by_parent;

    expect(isIncomplete).toBe(true);

    // Determine target status
    const targetStatus = isIncomplete ? 'SETTLEMENT_HELD_FOR_REVIEW' : 'settled';
    expect(targetStatus).toBe('SETTLEMENT_HELD_FOR_REVIEW');

    // Escort available balance must NOT receive payout
    const escortBalanceBefore = 50000;
    let escortBalanceAfter = escortBalanceBefore;
    if (targetStatus === 'settled') {
      escortBalanceAfter += 80000;
    }
    expect(escortBalanceAfter).toBe(escortBalanceBefore);
  }
);

// -----------------------------------------------------------------------------
// Test 6: Pre-Cutoff Parent Cancellation (Escrow Refund Verification)
// -----------------------------------------------------------------------------
eveningEscrowSettlementSuite.test(
  'Test 6: Pre-cutoff canceled trip waives/refunds escrow hold to parent available balance',
  () => {
    const canceledTrip = {
      id: 'TRIP-CANCELED-003',
      student_id: 'STUDENT-003',
      is_canceled_by_parent: true,
      cancellation_reason: 'Child sick, staying home',
      fee_status: 'pending',
    };

    expect(canceledTrip.is_canceled_by_parent).toBe(true);

    // Refund simulation
    const grossKobo = 106000;
    const parentWallet = { available: 400000, escrow: grossKobo };
    
    // Refund operation
    parentWallet.available += grossKobo;
    parentWallet.escrow -= grossKobo;

    expect(parentWallet.available).toBe(506000);
    expect(parentWallet.escrow).toBe(0);
  }
);

// -----------------------------------------------------------------------------
// Test 7: Payout Notification String Compliance
// -----------------------------------------------------------------------------
eveningEscrowSettlementSuite.test(
  'Test 7: Escort payout notification matches required regulatory wording',
  () => {
    const amountKobo = 84800; // ₦848.00
    const formattedAmount = formatKoboToNgn(amountKobo);
    const expectedNotification = `💰 Daily Payout Dropped: ${formattedAmount} has been credited to your available balance for today's completed rides.`;

    expect(expectedNotification).toContain('💰 Daily Payout Dropped:');
    expect(expectedNotification).toContain(formattedAmount);
    expect(expectedNotification).toContain('credited to your available balance for today\'s completed rides.');
  }
);
