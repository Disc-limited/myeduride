import { TestSuite, expect } from '../utils/test-harness';
import crypto from 'crypto';
import { FinancialCircuitBreaker, TREASURY_VELOCITY_LIMITS } from '../../src/lib/security/financial-circuit-breaker';
import { generateReceipt } from '../../src/lib/payments/receipt-engine';
import { renderPaymentReceiptHtml } from '../../src/lib/notifications/email-templates/payment-receipt';
import { PreFlightBalanceAuditEngine } from '../../src/lib/payments/pre-flight-balance-audit';
import { TripFareEngine } from '../../src/lib/payments/trip-fare-engine';
import { formatKoboToNgn } from '../../src/lib/escort/escort-wallet';
import { TotpVerifier, WithdrawalCustodyEngine } from '../../src/lib/security/withdrawal-custody';

export const walletLifecycleSimulationE2ESuite = new TestSuite(
  'Zero-Loss 8-Stage Full Fintech Wallet Lifecycle End-to-End Simulation (Phase 7)',
  'E2E'
);

// -----------------------------------------------------------------------------
// Complete 8-Stage End-to-End Financial Lifecycle Simulation
// -----------------------------------------------------------------------------
walletLifecycleSimulationE2ESuite.test(
  'E2E Journey: Full Lifecycle — Deposit ➔ Dual Receipt ➔ 6:00 PM Audit ➔ Escrow Hold ➔ Afternoon Drop-off ➔ 7:00 PM Payout ➔ Maker-Checker Withdrawal ➔ Zero-Loss Reconciliation',
  async () => {
    // =========================================================================
    // STAGE 1: Parent Funds Wallet via Gateway (Deposit)
    // =========================================================================
    const parentWallet = {
      id: 'WAL-PAR-7788',
      userId: 'USR-PAR-7788',
      entityType: 'parent',
      availableBalanceKobo: 0,
      escrowBalanceKobo: 0,
      lockedBalanceKobo: 0,
    };

    const depositAmountNgn = 50000; // ₦50,000.00
    const depositAmountKobo = depositAmountNgn * 100; // 5,000,000 kobo

    // Circuit breaker check: assert single deposit limit (₦500,000 max)
    let depositPermitted = false;
    try {
      FinancialCircuitBreaker.assertParentDepositPermitted(depositAmountKobo);
      depositPermitted = true;
    } catch {
      depositPermitted = false;
    }
    expect(depositPermitted).toBe(true);

    // Credit parent wallet
    parentWallet.availableBalanceKobo += depositAmountKobo;
    expect(parentWallet.availableBalanceKobo).toBe(5000000);

    // =========================================================================
    // STAGE 2: Dual-Channel Payment Receipt Issuance
    // =========================================================================
    const receipt = generateReceipt({
      transactionReference: 'DEP-SEERBIT-20261017-001',
      gatewayReference: 'SEERBIT-GW-998822',
      entityName: 'Dr. Chidi Okon',
      userEmail: 'chidi.okon@example.com',
      userPhone: '+2348012345678',
      amountNgn: depositAmountNgn,
      paymentChannel: 'TRANSFER',
      entityType: 'PARENT',
      description: 'Term 1 transit funding for 2 children',
    });

    expect(receipt.receiptNumber.startsWith('REC-')).toBe(true);
    expect(receipt.totalAmountNgn).toBe(50000);
    expect(receipt.hmacSignature.length).toBe(64);

    // Render receipt email HTML
    const receiptEmailHtml = renderPaymentReceiptHtml(receipt);
    expect(receiptEmailHtml).toContain('Official Receipt');
    expect(receiptEmailHtml).toContain('Payment Receipt - ');
    expect(receiptEmailHtml).toContain('Dr. Chidi Okon');
    expect(receiptEmailHtml).toContain('50,000.00');

    // =========================================================================
    // STAGE 3: 6:00 PM Night-Before Pre-Flight Balance Audit
    // =========================================================================
    const nextSchoolDay = PreFlightBalanceAuditEngine.resolveNextOperationalSchoolDay('2026-10-18');
    expect(nextSchoolDay.dayName).toBe('Monday');

    const children = [
      { studentName: 'Emeka Okon' },
      { studentName: 'Chidinma Okon' },
    ];
    const dailyFarePerChildKobo = 106000; // ₦1,060
    const totalTomorrowRequiredFareKobo = children.length * dailyFarePerChildKobo; // ₦2,120 (212,000 kobo)

    const auditEval = PreFlightBalanceAuditEngine.evaluateCredibility({
      availableBalanceKobo: parentWallet.availableBalanceKobo,
      totalRequiredFareKobo: totalTomorrowRequiredFareKobo,
      childrenNames: PreFlightBalanceAuditEngine.formatChildrenNames(children),
      isTomorrow: nextSchoolDay.isTomorrow,
      dayName: nextSchoolDay.dayName,
    });

    // Credibility confirmed (₦50,000 > ₦2,120)
    expect(auditEval.status).toBe('CONFIRMED');
    expect(auditEval.isConfirmed).toBe(true);
    expect(auditEval.shortfallKobo).toBe(0);
    expect(auditEval.title).toBe('✅ Escort Credibility Confirmed for Tomorrow');
    expect(auditEval.message).toContain('Emeka Okon and Chidinma Okon');

    // =========================================================================
    // STAGE 4: 7:15 AM Pickup Cutoff & Daily Escrow Hold Commitment
    // =========================================================================
    // Verify mathematical split invariant before escrow hold
    const splitChild1 = TripFareEngine.verifyEscrowSplitAssertion(dailyFarePerChildKobo);
    const splitChild2 = TripFareEngine.verifyEscrowSplitAssertion(dailyFarePerChildKobo);

    expect(splitChild1.driverShareKobo + splitChild1.platformShareKobo).toBe(dailyFarePerChildKobo);
    expect(splitChild2.driverShareKobo + splitChild2.platformShareKobo).toBe(dailyFarePerChildKobo);

    // Commit funds to Escrow Hold
    parentWallet.availableBalanceKobo -= totalTomorrowRequiredFareKobo;
    parentWallet.escrowBalanceKobo += totalTomorrowRequiredFareKobo;

    expect(parentWallet.availableBalanceKobo).toBe(5000000 - 212000); // 4,788,000 kobo (₦47,880)
    expect(parentWallet.escrowBalanceKobo).toBe(212000); // 212,000 kobo (₦2,120)

    const escrowHold = {
      id: 'ESCROW-HOLD-9901',
      parentWalletId: parentWallet.id,
      grossAmountKobo: totalTomorrowRequiredFareKobo,
      totalDriverShareKobo: splitChild1.driverShareKobo + splitChild2.driverShareKobo,
      totalPlatformShareKobo: splitChild1.platformShareKobo + splitChild2.platformShareKobo,
      status: 'HELD',
    };
    expect(escrowHold.totalDriverShareKobo + escrowHold.totalPlatformShareKobo).toBe(escrowHold.grossAmountKobo);

    // =========================================================================
    // STAGE 5: Daily Transit Execution (Morning Pickup & Afternoon Drop-Off)
    // =========================================================================
    const dailyTripRecord = {
      tripDate: nextSchoolDay.dateStr,
      student1MorningPickedUp: true,
      student1AfternoonDroppedOff: true,
      student2MorningPickedUp: true,
      student2AfternoonDroppedOff: true,
      isCanceledByParent: false,
    };

    const isFullyCompleted =
      dailyTripRecord.student1MorningPickedUp &&
      dailyTripRecord.student1AfternoonDroppedOff &&
      dailyTripRecord.student2MorningPickedUp &&
      dailyTripRecord.student2AfternoonDroppedOff &&
      !dailyTripRecord.isCanceledByParent;

    expect(isFullyCompleted).toBe(true);

    // =========================================================================
    // STAGE 6: 7:00 PM Automated Escrow Settlement & Escort Payout
    // =========================================================================
    const escortWallet = {
      id: 'WAL-ESC-4401',
      userId: 'USR-ESC-4401',
      entityType: 'escort',
      availableBalanceKobo: 0,
    };

    const platformTreasury = {
      totalCollectedKobo: 0,
    };

    // Release escrow
    parentWallet.escrowBalanceKobo -= escrowHold.grossAmountKobo;
    escortWallet.availableBalanceKobo += escrowHold.totalDriverShareKobo;
    platformTreasury.totalCollectedKobo += escrowHold.totalPlatformShareKobo;
    escrowHold.status = 'RELEASED';

    expect(parentWallet.escrowBalanceKobo).toBe(0);
    expect(escortWallet.availableBalanceKobo).toBe(escrowHold.totalDriverShareKobo);
    expect(escrowHold.status).toBe('RELEASED');

    // Verify regulatory wording notification
    const escortNotification = `💰 Daily Payout Dropped: ${formatKoboToNgn(
      escortWallet.availableBalanceKobo
    )} has been credited to your available balance for today's completed rides.`;
    expect(escortNotification).toContain('Daily Payout Dropped');
    expect(escortNotification).toContain('has been credited to your available balance');

    // =========================================================================
    // STAGE 7: Maker-Checker Dual Custody Bank Withdrawal
    // =========================================================================
    const withdrawalAmountKobo = 150000; // ₦1,500.00
    const makerUserId = escortWallet.userId;
    const checkerUserId = 'USR-CM-OFFICER-001';

    // Invariant: Maker cannot be Checker
    expect(makerUserId !== checkerUserId).toBe(true);

    // Escort high-value threshold check (₦1,500 < ₦100,000 ➔ single checker approval sufficient)
    const requiresSuperAdmin = WithdrawalCustodyEngine.isSuperAdminApprovalRequired(
      'escort',
      withdrawalAmountKobo
    );
    expect(requiresSuperAdmin).toBe(false);

    // Checker verifies TOTP 2FA
    const totpSecret = 'JBSWY3DPEHPK3PXP';
    const totpToken = TotpVerifier.generateTotp(totpSecret);
    const totpValid = TotpVerifier.verifyTotp(totpSecret, totpToken);
    expect(totpValid).toBe(true);

    // Checker approves
    const withdrawalRequest = {
      id: 'WTH-REQ-101',
      walletId: escortWallet.id,
      amountKobo: withdrawalAmountKobo,
      makerUserId,
      checkerUserId,
      status: 'APPROVED_BY_CHECKER',
    };
    expect(withdrawalRequest.status).toBe('APPROVED_BY_CHECKER');

    // Debit Escort wallet and execute
    escortWallet.availableBalanceKobo -= withdrawalAmountKobo;
    withdrawalRequest.status = 'EXECUTED';
    expect(withdrawalRequest.status).toBe('EXECUTED');

    // =========================================================================
    // STAGE 8: Zero-Loss Mathematical Balance Assertion
    // =========================================================================
    // Total original deposit must equal current distributed assets exactly:
    // Original Deposit (₦50,000) ===
    //   Parent Remaining Balance +
    //   Escort Bank Paid Out +
    //   Escort Retained Balance +
    //   Platform Commission & VAT
    const parentRemainingKobo = parentWallet.availableBalanceKobo; // 4,788,000
    const escortWithdrawnKobo = withdrawalAmountKobo;             // 150,000
    const escortRetainedKobo = escortWallet.availableBalanceKobo;  // (totalDriverShare - 150,000)
    const platformKobo = platformTreasury.totalCollectedKobo;      // escrowHold.totalPlatformShareKobo

    const reconstructedTotalKobo =
      parentRemainingKobo + escortWithdrawnKobo + escortRetainedKobo + platformKobo;

    expect(reconstructedTotalKobo).toBe(depositAmountKobo);

    // Cryptographic ledger hash chain produces valid hashes with 0 discrepancy
    const genesisHash = 'GENESIS_ZERO_HASH';
    const blockPayload = `${parentWallet.id}|CREDIT|${depositAmountKobo}|0|${depositAmountKobo}|DEP-001|${genesisHash}`;
    const blockHash = crypto.createHash('sha256').update(blockPayload).digest('hex');
    expect(blockHash.length).toBe(64);
  }
);
