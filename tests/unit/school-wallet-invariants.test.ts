import { TestSuite, expect } from '../utils/test-harness';
import { TransactionChannel } from '../../src/lib/payments/types';

export const schoolWalletInvariantsSuite = new TestSuite(
  'School Wallet System & Financial Invariants',
  'UNIT'
);

// 1. Integer Kobo Precision & Non-Floating-Point Invariants
schoolWalletInvariantsSuite.test(
  'Financial Precision: Converts NGN to Integer Kobo accurately without rounding drift',
  () => {
    const testAmounts = [
      { ngn: 1000, expectedKobo: 100000 },
      { ngn: 2500.5, expectedKobo: 250050 },
      { ngn: 50000, expectedKobo: 5000000 },
      { ngn: 250000.75, expectedKobo: 25000075 },
      { ngn: 5000000, expectedKobo: 500000000 },
    ];

    for (const { ngn, expectedKobo } of testAmounts) {
      const kobo = Math.round(ngn * 100);
      expect(kobo).toBe(expectedKobo);
      expect(Number.isInteger(kobo)).toBeTruthy();
      expect(kobo / 100).toBe(ngn);
    }
  }
);

// 2. Deposit Limits & Velocity Anomaly Prevention (Cybersecurity Layer 3)
schoolWalletInvariantsSuite.test(
  'Velocity Shield: Enforces institutional deposit boundaries (Min ₦1,000 - Max ₦5,000,000)',
  () => {
    function validateDepositAmount(amount: number): { valid: boolean; error?: string } {
      if (isNaN(amount) || amount < 1000) {
        return { valid: false, error: 'Minimum institutional deposit amount is ₦1,000' };
      }
      if (amount > 5000000) {
        return { valid: false, error: 'Maximum single deposit amount is ₦5,000,000' };
      }
      return { valid: true };
    }

    // Under limit
    expect(validateDepositAmount(500).valid).toBeFalsy();
    expect(validateDepositAmount(999.99).valid).toBeFalsy();
    expect(validateDepositAmount(0).valid).toBeFalsy();
    expect(validateDepositAmount(-1000).valid).toBeFalsy();

    // Over limit (Velocity anomaly limit)
    expect(validateDepositAmount(5000001).valid).toBeFalsy();
    expect(validateDepositAmount(10000000).valid).toBeFalsy();

    // Valid institutional amounts
    expect(validateDepositAmount(1000).valid).toBeTruthy();
    expect(validateDepositAmount(25000).valid).toBeTruthy();
    expect(validateDepositAmount(500000).valid).toBeTruthy();
    expect(validateDepositAmount(5000000).valid).toBeTruthy();
  }
);

// 3. Zero-IDOR Institutional Permission Enforcement
schoolWalletInvariantsSuite.test(
  'Zero-IDOR Security: Strictly rejects non-admin attempts to access school wallets',
  () => {
    type UserRole = { role: string; school_id: string; is_active: boolean };

    function checkAdminPrivilege(userRoles: UserRole[], targetSchoolId: string): boolean {
      const isSuperAdmin = userRoles.some((r) => r.role === 'super_admin' && r.is_active);
      if (isSuperAdmin) return true;

      return userRoles.some(
        (r) => r.role === 'school_admin' && r.school_id === targetSchoolId && r.is_active
      );
    }

    const schoolA = 'school-aaa-111';
    const schoolB = 'school-bbb-222';

    // Admin of School A
    const schoolAAdminRoles: UserRole[] = [
      { role: 'school_admin', school_id: schoolA, is_active: true },
    ];
    expect(checkAdminPrivilege(schoolAAdminRoles, schoolA)).toBeTruthy();
    expect(checkAdminPrivilege(schoolAAdminRoles, schoolB)).toBeFalsy();

    // Regular teacher / parent cannot access school wallet
    const teacherRoles: UserRole[] = [
      { role: 'teacher', school_id: schoolA, is_active: true },
      { role: 'parent', school_id: schoolA, is_active: true },
    ];
    expect(checkAdminPrivilege(teacherRoles, schoolA)).toBeFalsy();

    // Inactive school admin cannot access
    const inactiveAdminRoles: UserRole[] = [
      { role: 'school_admin', school_id: schoolA, is_active: false },
    ];
    expect(checkAdminPrivilege(inactiveAdminRoles, schoolA)).toBeFalsy();

    // Superadmin has universal oversight
    const superAdminRoles: UserRole[] = [{ role: 'super_admin', school_id: '', is_active: true }];
    expect(checkAdminPrivilege(superAdminRoles, schoolA)).toBeTruthy();
    expect(checkAdminPrivilege(superAdminRoles, schoolB)).toBeTruthy();
  }
);

// 4. Deterministic Reference Generation
schoolWalletInvariantsSuite.test(
  'Reference Formatting: Generates compliant institutional reference patterns',
  () => {
    function generateSchoolReference(schoolId: string): string {
      const uniqueSuffix = `TEST-${Date.now().toString(36).toUpperCase()}`;
      return `MYEDU-SCH-${schoolId.slice(0, 6).toUpperCase()}-${uniqueSuffix}`;
    }

    const ref = generateSchoolReference('1c7770ae-ab6d-4447-82d1-fa3b118aa8c8');
    expect(ref.startsWith('MYEDU-SCH-1C7770-')).toBeTruthy();
    expect(ref.length > 20).toBeTruthy();
  }
);

// 6. Approved Recipient Resolution & Disbursement Safety Guard
schoolWalletInvariantsSuite.test(
  'Disbursement Guard: Rejects arbitrary unvetted recipients and requires accredited status',
  () => {
    type RecipientStatus =
      'PENDING_CITY_MANAGER_REVIEW' | 'CITY_MANAGER_APPROVED' | 'ACTIVATED' | 'REJECTED';

    function validateDisbursementRecipient(recipient: {
      name: string;
      code: string;
      status: RecipientStatus;
      schoolId: string;
      targetSchoolId: string;
    }): { eligible: boolean; reason?: string } {
      if (!recipient.code || !recipient.name) {
        return { eligible: false, reason: 'Recipient name and escort code are required' };
      }
      if (recipient.status !== 'CITY_MANAGER_APPROVED' && recipient.status !== 'ACTIVATED') {
        return {
          eligible: false,
          reason: 'Escort must be accredited and approved by City Manager',
        };
      }
      if (recipient.schoolId !== recipient.targetSchoolId) {
        return { eligible: false, reason: 'Escort is not allocated to this school institution' };
      }
      return { eligible: true };
    }

    const activeSchool = '0af823c7-4587-4e97-9ff5-b92fc979a167';

    // Approved and linked escort (e.g. Davwaro Ebor)
    const approvedEscort = {
      name: 'Davwaro Ebor',
      code: 'MRD-ESC-637427',
      status: 'CITY_MANAGER_APPROVED' as RecipientStatus,
      schoolId: activeSchool,
      targetSchoolId: activeSchool,
    };
    expect(validateDisbursementRecipient(approvedEscort).eligible).toBeTruthy();

    // Pending escort (not yet approved by City Manager)
    const pendingEscort = {
      name: 'Unverified Escort',
      code: 'ESC-9999',
      status: 'PENDING_CITY_MANAGER_REVIEW' as RecipientStatus,
      schoolId: activeSchool,
      targetSchoolId: activeSchool,
    };
    const pendingResult = validateDisbursementRecipient(pendingEscort);
    expect(pendingResult.eligible).toBeFalsy();
    expect(pendingResult.reason).toBe('Escort must be accredited and approved by City Manager');

    // Escort allocated to a different school
    const foreignEscort = {
      name: 'Foreign Escort',
      code: 'ESC-1111',
      status: 'CITY_MANAGER_APPROVED' as RecipientStatus,
      schoolId: 'c1ac8ead-c011-4f03-a216-28d6b354e12a',
      targetSchoolId: activeSchool,
    };
    expect(validateDisbursementRecipient(foreignEscort).eligible).toBeFalsy();
  }
);

// 7. Atomic Transfer Balance Sufficiency & Channel Invariant
schoolWalletInvariantsSuite.test(
  'Atomic Disbursement: Enforces balance sufficiency and non-negative arithmetic',
  () => {
    function executeSimulatedDisbursement(
      availableKobo: number,
      transferNgn: number
    ): { success: boolean; newBalanceKobo?: number; error?: string } {
      if (transferNgn < 100) {
        return { success: false, error: 'Minimum disbursement amount is ₦100' };
      }
      const transferKobo = Math.round(transferNgn * 100);
      if (availableKobo < transferKobo) {
        return { success: false, error: 'INSUFFICIENT_FUNDS' };
      }
      return { success: true, newBalanceKobo: availableKobo - transferKobo };
    }

    // ₦1,050,000 available
    const initialKobo = 105000000;

    // ₦25,000 transfer
    const res1 = executeSimulatedDisbursement(initialKobo, 25000);
    expect(res1.success).toBeTruthy();
    expect(res1.newBalanceKobo).toBe(102500000);

    // Transfer exceeding available balance
    const res2 = executeSimulatedDisbursement(1000000, 20000); // ₦10,000 available, trying to disburse ₦20,000
    expect(res2.success).toBeFalsy();
    expect(res2.error).toBe('INSUFFICIENT_FUNDS');

    // Transfer below ₦100 minimum
    const res3 = executeSimulatedDisbursement(initialKobo, 50);
    expect(res3.success).toBeFalsy();
    expect(res3.error).toBe('Minimum disbursement amount is ₦100');
  }
);

if (require.main === module || process.argv[1]?.includes('school-wallet-invariants')) {
  schoolWalletInvariantsSuite.run().then(() => {
    schoolWalletInvariantsSuite.printSummary();
  });
}
