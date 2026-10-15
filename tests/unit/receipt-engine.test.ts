/**
 * UNIT TEST SUITE: Standardized Cryptographic Receipt Engine
 * Verifies:
 * 1. Receipt Number formatting (REC-YYYYMMDD-XXXX)
 * 2. Statutory VAT calculation (7.5% net + vat = total)
 * 3. Africa/Lagos timezone formatting
 * 4. SHA-256 HMAC cryptographic generation and tamper-detection
 * 5. Adapter from transaction rows
 */

import { TestSuite, expect } from '../utils/test-harness';
import {
  generateReceipt,
  calculateVatBreakdown,
  generateReceiptNumber,
  formatLagosTimestamp,
  verifyReceiptHmac,
  buildReceiptFromTransaction,
  ReceiptData,
} from '../../src/lib/payments/receipt-engine';

export const receiptEngineSuite = new TestSuite(
  'Cryptographic Receipt Engine & VAT Architecture',
  'UNIT'
);

// 1. Statutory VAT 7.5% Breakdown Arithmetic
receiptEngineSuite.test(
  'Statutory VAT Arithmetic: Guarantees Net + 7.5% VAT exactly equals Total Paid without drift',
  () => {
    // 25,000 NGN
    const breakdown1 = calculateVatBreakdown(25000);
    expect(breakdown1.totalAmountNgn).toBe(25000);
    expect(breakdown1.netAmountNgn).toBe(23255.81);
    expect(breakdown1.vatAmountNgn).toBe(1744.19);
    expect(Math.round((breakdown1.netAmountNgn + breakdown1.vatAmountNgn) * 100) / 100).toBe(25000);

    // 100,000 NGN
    const breakdown2 = calculateVatBreakdown(100000);
    expect(breakdown2.totalAmountNgn).toBe(100000);
    expect(breakdown2.netAmountNgn).toBe(93023.26);
    expect(breakdown2.vatAmountNgn).toBe(6976.74);
    expect(Math.round((breakdown2.netAmountNgn + breakdown2.vatAmountNgn) * 100) / 100).toBe(100000);

    // 0 NGN
    const breakdown0 = calculateVatBreakdown(0);
    expect(breakdown0.netAmountNgn).toBe(0);
    expect(breakdown0.vatAmountNgn).toBe(0);
  }
);

// 2. Receipt Number Format (REC-YYYYMMDD-XXXX)
receiptEngineSuite.test(
  'Receipt Number Format: Generates canonical REC-YYYYMMDD-XXXX string with deterministic suffix',
  () => {
    const fixedDate = new Date('2026-10-15T10:30:00Z');
    const recNo = generateReceiptNumber(fixedDate, 'MYEDU-DEP-PARENT-12345');
    const match = recNo.match(/^REC-(\d{8})-([A-Z0-9]{4})$/);
    expect(match !== null).toBeTruthy();
    expect(match![1]).toBe('20261015');

    // Deterministic generation: Same reference produces same receipt suffix
    const recNo2 = generateReceiptNumber(fixedDate, 'MYEDU-DEP-PARENT-12345');
    expect(recNo).toBe(recNo2);
  }
);

// 3. Africa/Lagos Timezone Formatting
receiptEngineSuite.test(
  'Timezone Invariance: Accurately formats dates in Africa/Lagos (UTC+1) timezone',
  () => {
    const d = new Date('2026-10-15T07:15:00Z'); // UTC 07:15 = Lagos 08:15 (+1)
    const formatted = formatLagosTimestamp(d);
    expect(formatted.includes('15 Oct 2026')).toBeTruthy();
    expect(formatted.includes('08:15 AM')).toBeTruthy();
  }
);

// 4. SHA-256 HMAC Hardening and Tamper Detection
receiptEngineSuite.test(
  'HMAC Hardening: Verifies authenticity of untampered receipts and rejects forged payloads',
  () => {
    const receipt: ReceiptData = generateReceipt({
      transactionReference: 'MYEDU-DEP-TEST-9988',
      gatewayReference: 'SEERBIT-REF-776655',
      entityName: 'Babatunde Adeleke',
      userEmail: 'babatunde@example.com',
      userPhone: '+2348012345678',
      amountNgn: 50000,
      paymentChannel: 'CARD',
      timestamp: '2026-10-15T12:00:00Z',
    });

    expect(receipt.hmacSignature.length).toBe(64);

    // Pristine receipt must verify
    expect(verifyReceiptHmac(receipt)).toBeTruthy();

    // Tampered amount must fail verification
    const tamperedAmount: ReceiptData = { ...receipt, totalAmountNgn: 99999 };
    expect(verifyReceiptHmac(tamperedAmount)).toBeFalsy();

    // Tampered reference must fail verification
    const tamperedRef: ReceiptData = { ...receipt, transactionReference: 'FORGED-REF' };
    expect(verifyReceiptHmac(tamperedRef)).toBeFalsy();

    // Tampered email must fail verification
    const tamperedEmail: ReceiptData = { ...receipt, userEmail: 'hacker@malicious.com' };
    expect(verifyReceiptHmac(tamperedEmail)).toBeFalsy();
  }
);

// 5. Database Transaction Adapter
receiptEngineSuite.test(
  'Transaction Adapter: Builds verified ReceiptData from raw ledger rows and entity fallbacks',
  () => {
    const rawTx = {
      id: 'tx-uuid-1234',
      reference: 'MYEDU-SCH-SOLID-4321',
      amount_ngn: 150000,
      balance_after_ngn: 450000,
      channel: 'SEERBIT_CHECKOUT',
      description: 'Institutional wallet deposit',
      created_at: '2026-10-15T09:00:00Z',
      metadata: {
        school_name: 'Solidstone High School',
        admin_email: 'admin@solidstone.edu.ng',
      },
    };

    const receipt = buildReceiptFromTransaction(rawTx);
    expect(receipt.entityType).toBe('SCHOOL');
    expect(receipt.entityName).toBe('Solidstone High School');
    expect(receipt.userEmail).toBe('admin@solidstone.edu.ng');
    expect(receipt.totalAmountNgn).toBe(150000);
    expect(verifyReceiptHmac(receipt)).toBeTruthy();
  }
);

if (require.main === module) {
  receiptEngineSuite.run().then(() => receiptEngineSuite.printSummary());
}
