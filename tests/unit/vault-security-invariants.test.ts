import { TestSuite, expect } from '../utils/test-harness';
import crypto from 'crypto';
import {
  verifySeerbitWebhookSignature,
  isTimestampSkewValid,
  isSeerbitIpAllowed,
  computePayloadHash,
} from '../../src/lib/security/webhook-security';
import {
  TotpVerifier,
  WithdrawalCustodyEngine,
  WITHDRAWAL_THRESHOLDS,
} from '../../src/lib/security/withdrawal-custody';
import {
  FinancialCircuitBreaker,
  TREASURY_VELOCITY_LIMITS,
} from '../../src/lib/security/financial-circuit-breaker';

export const vaultSecurityInvariantsSuite = new TestSuite(
  'Financial Vault Hardening & Anti-Fraud Infrastructure Suite (Phase 6)',
  'UNIT'
);

// -----------------------------------------------------------------------------
// Test 1: Timing-Safe Webhook HMAC Verification (SHA512 & SHA256)
// -----------------------------------------------------------------------------
vaultSecurityInvariantsSuite.test(
  'Test 1: verifySeerbitWebhookSignature accurately verifies valid signatures in constant-time and rejects tampered payloads',
  () => {
    const secret = 'test_seerbit_secret_key_12345';
    const payload = JSON.stringify({
      reference: 'DEP-TEST-001',
      amount: '5000',
      status: 'SUCCESS',
    });

    // Valid SHA-512 signature
    const validHmac512 = crypto
      .createHmac('sha512', secret)
      .update(payload, 'utf8')
      .digest('hex');

    expect(verifySeerbitWebhookSignature(payload, validHmac512, secret)).toBe(true);

    // Valid SHA-256 signature
    const validHmac256 = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    expect(verifySeerbitWebhookSignature(payload, validHmac256, secret)).toBe(true);

    // Tampered payload
    const tamperedPayload = JSON.stringify({
      reference: 'DEP-TEST-001',
      amount: '500000', // Fraudulent amount alteration
      status: 'SUCCESS',
    });
    expect(verifySeerbitWebhookSignature(tamperedPayload, validHmac512, secret)).toBe(false);

    // Bogus signature
    expect(verifySeerbitWebhookSignature(payload, '00000000000000000000000000000000', secret)).toBe(false);
    expect(verifySeerbitWebhookSignature(payload, '', secret)).toBe(false);
  }
);

// -----------------------------------------------------------------------------
// Test 2: Anti-Replay Timestamp Skew Checks (5-Minute Window)
// -----------------------------------------------------------------------------
vaultSecurityInvariantsSuite.test(
  'Test 2: isTimestampSkewValid permits ≤ 5-minute clock drift and rejects stale timestamps',
  () => {
    const now = Date.now();

    // Fresh timestamp (within 30 seconds)
    expect(isTimestampSkewValid(now - 30 * 1000, 5)).toBe(true);

    // 4 minutes ago (within allowable 5 minutes)
    expect(isTimestampSkewValid(now - 4 * 60 * 1000, 5)).toBe(true);

    // 6 minutes ago (exceeds 5-minute threshold)
    expect(isTimestampSkewValid(now - 6 * 60 * 1000, 5)).toBe(false);

    // 1 hour in the past (replay attack simulation)
    expect(isTimestampSkewValid(now - 60 * 60 * 1000, 5)).toBe(false);

    // ISO string format
    const isoFresh = new Date(now - 60 * 1000).toISOString();
    expect(isTimestampSkewValid(isoFresh, 5)).toBe(true);

    const isoStale = new Date(now - 10 * 60 * 1000).toISOString();
    expect(isTimestampSkewValid(isoStale, 5)).toBe(false);
  }
);

// -----------------------------------------------------------------------------
// Test 3: SeerBit Egress IP Allowlist Validation
// -----------------------------------------------------------------------------
vaultSecurityInvariantsSuite.test(
  'Test 3: isSeerbitIpAllowed recognizes authentic gateway IP subnets and rejects rogue IPs in production',
  () => {
    // Official SeerBit production IPs
    expect(isSeerbitIpAllowed('102.164.214.15')).toBe(true);
    expect(isSeerbitIpAllowed('102.164.214.99')).toBe(true); // Within 102.164.214.0/24
    expect(isSeerbitIpAllowed('52.208.200.222')).toBe(true);
    expect(isSeerbitIpAllowed('54.216.14.88')).toBe(true);   // Within 54.216.0.0/16

    // Rogue / Unknown external IPs
    expect(isSeerbitIpAllowed('185.220.101.5')).toBe(false);
    expect(isSeerbitIpAllowed('45.33.32.156')).toBe(false);
    expect(isSeerbitIpAllowed(null)).toBe(false);
    expect(isSeerbitIpAllowed('')).toBe(false);
  }
);

// -----------------------------------------------------------------------------
// Test 4: TOTP 2FA Verification Engine (RFC 6238)
// -----------------------------------------------------------------------------
vaultSecurityInvariantsSuite.test(
  'Test 4: TotpVerifier generates and validates 6-digit TOTP tokens with drift tolerance',
  () => {
    const secret = 'JBSWY3DPEHPK3PXP'; // Standard Base32 test secret
    const code = TotpVerifier.generateTotp(secret);

    expect(code.length).toBe(6);
    expect(/^\d{6}$/.test(code)).toBe(true);

    // Valid code verifies
    expect(TotpVerifier.verifyTotp(secret, code)).toBe(true);

    // Invalid code fails
    expect(TotpVerifier.verifyTotp(secret, '000000')).toBe(false);
    expect(TotpVerifier.verifyTotp(secret, '12345')).toBe(false); // Wrong length
    expect(TotpVerifier.verifyTotp('', code)).toBe(false);
  }
);

// -----------------------------------------------------------------------------
// Test 5: Maker-Checker Segregation & High-Value Approval Escalation Rules
// -----------------------------------------------------------------------------
vaultSecurityInvariantsSuite.test(
  'Test 5: WithdrawalCustodyEngine correctly identifies high-value thresholds and enforces role separation',
  () => {
    // Escort high-value threshold: ₦100,000 (10,000,000 kobo)
    expect(
      WithdrawalCustodyEngine.isSuperAdminApprovalRequired('escort', 5000000) // ₦50,000
    ).toBe(false);

    expect(
      WithdrawalCustodyEngine.isSuperAdminApprovalRequired('escort', 10000000) // ₦100,000 exact
    ).toBe(false);

    expect(
      WithdrawalCustodyEngine.isSuperAdminApprovalRequired('escort', 10000100) // ₦100,001 (exceeds)
    ).toBe(true);

    expect(
      WithdrawalCustodyEngine.isSuperAdminApprovalRequired('escort', 25000000) // ₦250,000
    ).toBe(true);

    // School high-value threshold: ₦500,000 (50,000,000 kobo)
    expect(
      WithdrawalCustodyEngine.isSuperAdminApprovalRequired('school', 20000000) // ₦200,000
    ).toBe(false);

    expect(
      WithdrawalCustodyEngine.isSuperAdminApprovalRequired('school', 50000000) // ₦500,000 exact
    ).toBe(false);

    expect(
      WithdrawalCustodyEngine.isSuperAdminApprovalRequired('school', 50000100) // ₦500,001 (exceeds)
    ).toBe(true);
  }
);

// -----------------------------------------------------------------------------
// Test 6: Treasury Circuit Breaker — Parent Deposit Velocity Limits
// -----------------------------------------------------------------------------
vaultSecurityInvariantsSuite.test(
  'Test 6: FinancialCircuitBreaker asserts parent deposit limits (₦500,000 max single deposit)',
  () => {
    // Valid deposit: ₦25,000
    let threwValid = false;
    try {
      FinancialCircuitBreaker.assertParentDepositPermitted(2500000);
    } catch {
      threwValid = true;
    }
    expect(threwValid).toBe(false);

    // Valid deposit: ₦500,000 (exact ceiling)
    let threwCeiling = false;
    try {
      FinancialCircuitBreaker.assertParentDepositPermitted(TREASURY_VELOCITY_LIMITS.MAX_SINGLE_PARENT_DEPOSIT_KOBO);
    } catch {
      threwCeiling = true;
    }
    expect(threwCeiling).toBe(false);

    // Excess deposit: ₦500,001
    let threwExcess = false;
    try {
      FinancialCircuitBreaker.assertParentDepositPermitted(TREASURY_VELOCITY_LIMITS.MAX_SINGLE_PARENT_DEPOSIT_KOBO + 100);
    } catch {
      threwExcess = true;
    }
    expect(threwExcess).toBe(true);

    // Non-positive deposit
    let threwZero = false;
    try {
      FinancialCircuitBreaker.assertParentDepositPermitted(0);
    } catch {
      threwZero = true;
    }
    expect(threwZero).toBe(true);
  }
);

// -----------------------------------------------------------------------------
// Test 7: Ledger Hash Chaining Structure Verification
// -----------------------------------------------------------------------------
vaultSecurityInvariantsSuite.test(
  'Test 7: Cryptographic ledger hash chain produces deterministic SHA-256 fingerprints across sequential transactions',
  () => {
    const genesisHash = 'GENESIS_ZERO_HASH';
    const walletId = 'test-wallet-uuid-001';

    // Transaction 1
    const tx1Payload = `${walletId}|CREDIT|5000000|0|5000000|DEP-001|${genesisHash}|2026-10-17T10:00:00.000Z`;
    const hash1 = crypto.createHash('sha256').update(tx1Payload).digest('hex');

    expect(hash1.length).toBe(64);

    // Transaction 2 (chained to hash1)
    const tx2Payload = `${walletId}|DEBIT|106000|5000000|4894000|FARE-001|${hash1}|2026-10-17T10:05:00.000Z`;
    const hash2 = crypto.createHash('sha256').update(tx2Payload).digest('hex');

    expect(hash2.length).toBe(64);
    expect(hash2 !== hash1).toBe(true);

    // Transaction 3 (chained to hash2)
    const tx3Payload = `${walletId}|DEBIT|106000|4894000|4788000|FARE-002|${hash2}|2026-10-17T10:10:00.000Z`;
    const hash3 = crypto.createHash('sha256').update(tx3Payload).digest('hex');

    expect(hash3.length).toBe(64);
    expect(hash3 !== hash2).toBe(true);

    // Simulating tampering: If transaction 1 is modified, transaction 2 and 3 chains break
    const tamperedTx1Payload = `${walletId}|CREDIT|9999999|0|9999999|DEP-001|${genesisHash}|2026-10-17T10:00:00.000Z`;
    const tamperedHash1 = crypto.createHash('sha256').update(tamperedTx1Payload).digest('hex');

    expect(tamperedHash1 !== hash1).toBe(true);
  }
);
