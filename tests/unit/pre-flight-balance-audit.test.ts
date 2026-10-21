import { TestSuite, expect } from '../utils/test-harness';
import { PreFlightBalanceAuditEngine } from '../../src/lib/payments/pre-flight-balance-audit';
import { renderPreFlightAuditEmailHtml } from '../../src/lib/notifications/email-templates/pre-flight-balance-audit';

export const preFlightBalanceAuditSuite = new TestSuite(
  'Night-Before 6:00 PM Pre-Flight Balance Audit & Credibility Suite (Phase 5)',
  'UNIT'
);

// -----------------------------------------------------------------------------
// Test 1: Operational School Day Resolver (Weekend Skipping Invariants)
// -----------------------------------------------------------------------------
preFlightBalanceAuditSuite.test(
  'Test 1: resolveNextOperationalSchoolDay skips weekends to Monday while handling weekdays cleanly',
  () => {
    // Friday -> Monday (3 days ahead)
    const friday = PreFlightBalanceAuditEngine.resolveNextOperationalSchoolDay('2026-10-16');
    expect(friday.dateStr).toBe('2026-10-19');
    expect(friday.dayName).toBe('Monday');
    expect(friday.daysAhead).toBe(3);
    expect(friday.isTomorrow).toBe(false);

    // Saturday -> Monday (2 days ahead)
    const saturday = PreFlightBalanceAuditEngine.resolveNextOperationalSchoolDay('2026-10-17');
    expect(saturday.dateStr).toBe('2026-10-19');
    expect(saturday.dayName).toBe('Monday');
    expect(saturday.daysAhead).toBe(2);
    expect(saturday.isTomorrow).toBe(false);

    // Sunday -> Monday (1 day ahead / tomorrow)
    const sunday = PreFlightBalanceAuditEngine.resolveNextOperationalSchoolDay('2026-10-18');
    expect(sunday.dateStr).toBe('2026-10-19');
    expect(sunday.dayName).toBe('Monday');
    expect(sunday.daysAhead).toBe(1);
    expect(sunday.isTomorrow).toBe(true);

    // Monday -> Tuesday (1 day ahead / tomorrow)
    const monday = PreFlightBalanceAuditEngine.resolveNextOperationalSchoolDay('2026-10-19');
    expect(monday.dateStr).toBe('2026-10-20');
    expect(monday.dayName).toBe('Tuesday');
    expect(monday.daysAhead).toBe(1);
    expect(monday.isTomorrow).toBe(true);

    // Thursday -> Friday (1 day ahead / tomorrow)
    const thursday = PreFlightBalanceAuditEngine.resolveNextOperationalSchoolDay('2026-10-22');
    expect(thursday.dateStr).toBe('2026-10-23');
    expect(thursday.dayName).toBe('Friday');
    expect(thursday.daysAhead).toBe(1);
    expect(thursday.isTomorrow).toBe(true);
  }
);

// -----------------------------------------------------------------------------
// Test 2: Children Names Natural Language Formatting
// -----------------------------------------------------------------------------
preFlightBalanceAuditSuite.test(
  'Test 2: formatChildrenNames formats single, pair, and trio child names correctly',
  () => {
    expect(PreFlightBalanceAuditEngine.formatChildrenNames([])).toBe('your children');

    expect(
      PreFlightBalanceAuditEngine.formatChildrenNames([{ studentName: 'Emeka Eze' }])
    ).toBe('Emeka Eze');

    expect(
      PreFlightBalanceAuditEngine.formatChildrenNames([
        { studentName: 'Emeka Eze' },
        { studentName: 'Chidinma Eze' },
      ])
    ).toBe('Emeka Eze and Chidinma Eze');

    expect(
      PreFlightBalanceAuditEngine.formatChildrenNames([
        { studentName: 'Emeka' },
        { studentName: 'Chidinma' },
        { studentName: 'Zainab' },
      ])
    ).toBe('Emeka, Chidinma and Zainab');
  }
);

// -----------------------------------------------------------------------------
// Test 3: Branch A — Credibility Confirmed (Exact & Surplus Balances)
// -----------------------------------------------------------------------------
preFlightBalanceAuditSuite.test(
  'Test 3: Branch A — Sufficient balance sets CONFIRMED status with exact required wording',
  () => {
    // Case 1: Surplus balance (₦5,000 balance vs ₦1,060 fare)
    const surplusEval = PreFlightBalanceAuditEngine.evaluateCredibility({
      availableBalanceKobo: 500000,
      totalRequiredFareKobo: 106000,
      childrenNames: 'Emeka Eze',
      isTomorrow: true,
      dayName: 'Tuesday',
    });

    expect(surplusEval.isConfirmed).toBe(true);
    expect(surplusEval.status).toBe('CONFIRMED');
    expect(surplusEval.shortfallKobo).toBe(0);
    expect(surplusEval.shortfallNgn).toBe(0);
    expect(surplusEval.title).toBe('✅ Escort Credibility Confirmed for Tomorrow');
    expect(surplusEval.message).toContain('is sufficient for tomorrow\'s scheduled school transport for Emeka Eze');
    expect(surplusEval.message).toContain('Your escort pickup is fully confirmed');

    // Case 2: Exact boundary match (₦1,060 balance vs ₦1,060 fare)
    const exactEval = PreFlightBalanceAuditEngine.evaluateCredibility({
      availableBalanceKobo: 106000,
      totalRequiredFareKobo: 106000,
      childrenNames: 'Chidinma Eze',
      isTomorrow: true,
      dayName: 'Wednesday',
    });

    expect(exactEval.isConfirmed).toBe(true);
    expect(exactEval.status).toBe('CONFIRMED');
    expect(exactEval.shortfallKobo).toBe(0);
  }
);

// -----------------------------------------------------------------------------
// Test 4: Branch B — Low Balance Top-Up Advisory & Shortfall Calculation
// -----------------------------------------------------------------------------
preFlightBalanceAuditSuite.test(
  'Test 4: Branch B — Deficit balance flags TOPUP_REQUIRED with exact shortfall in kobo',
  () => {
    // Parent has ₦500 (50,000 kobo) vs ₦1,060 (106,000 kobo)
    const deficitEval = PreFlightBalanceAuditEngine.evaluateCredibility({
      availableBalanceKobo: 50000,
      totalRequiredFareKobo: 106000,
      childrenNames: 'Tunde Bakare',
      isTomorrow: true,
      dayName: 'Thursday',
    });

    expect(deficitEval.isConfirmed).toBe(false);
    expect(deficitEval.status).toBe('TOPUP_REQUIRED');
    expect(deficitEval.shortfallKobo).toBe(56000); // ₦560 shortfall
    expect(deficitEval.shortfallNgn).toBe(560);
    expect(deficitEval.title).toBe('⚠️ Top-Up Required: Fund Wallet for Tomorrow\'s Ride');
    expect(deficitEval.message).toContain('which is below tomorrow\'s required fare of');
    expect(deficitEval.message).toContain('MyEduRide operates on daily funding—please top up your wallet tonight to avoid morning pickup disruption');
    expect(deficitEval.actionUrl).toContain('shortfall=560');

    // Zero balance test
    const zeroEval = PreFlightBalanceAuditEngine.evaluateCredibility({
      availableBalanceKobo: 0,
      totalRequiredFareKobo: 106000,
      childrenNames: 'Amina Bello',
      isTomorrow: true,
      dayName: 'Friday',
    });

    expect(zeroEval.isConfirmed).toBe(false);
    expect(zeroEval.shortfallKobo).toBe(106000);
    expect(zeroEval.shortfallNgn).toBe(1060);
  }
);

// -----------------------------------------------------------------------------
// Test 5: Multi-Child Fare Aggregation & Proportional Shortfall
// -----------------------------------------------------------------------------
preFlightBalanceAuditSuite.test(
  'Test 5: Correctly sums total required fare across multiple children for single parent',
  () => {
    // 3 Children at ₦1,060 each = ₦3,180 total (318,000 kobo)
    const children = [
      { studentName: 'Emeka' },
      { studentName: 'Chidinma' },
      { studentName: 'Somto' },
    ];
    const totalRequiredFareKobo = 3 * 106000; // 318,000 kobo

    // Parent balance is ₦2,000 (200,000 kobo)
    const parentBalanceKobo = 200000;
    const childrenNames = PreFlightBalanceAuditEngine.formatChildrenNames(children);
    expect(childrenNames).toBe('Emeka, Chidinma and Somto');

    const evalResult = PreFlightBalanceAuditEngine.evaluateCredibility({
      availableBalanceKobo: parentBalanceKobo,
      totalRequiredFareKobo,
      childrenNames,
      isTomorrow: true,
      dayName: 'Monday',
    });

    expect(evalResult.status).toBe('TOPUP_REQUIRED');
    expect(evalResult.shortfallKobo).toBe(118000); // ₦1,180
    expect(evalResult.shortfallNgn).toBe(1180);
    expect(evalResult.message).toContain('which is below tomorrow\'s required fare of ₦3,180.00');
  }
);

// -----------------------------------------------------------------------------
// Test 6: Email HTML Template Generation Verification
// -----------------------------------------------------------------------------
preFlightBalanceAuditSuite.test(
  'Test 6: renderPreFlightAuditEmailHtml outputs compliant HTML for both Branch A and Branch B',
  () => {
    // Branch A HTML
    const confirmedHtml = renderPreFlightAuditEmailHtml({
      parentName: 'Chief Emeka Okon',
      parentEmail: 'emeka@example.com',
      targetDateFormatted: 'Monday, 19 October 2026',
      dayLabel: 'Tomorrow',
      childrenNames: 'Emeka Jr and Somto',
      childrenList: [
        { name: 'Emeka Jr', schoolName: 'Corona School Victoria Island', fareNgn: 1060 },
        { name: 'Somto', schoolName: 'Corona School Victoria Island', fareNgn: 1060 },
      ],
      availableBalanceNgn: 10000,
      totalRequiredFareNgn: 2120,
      shortfallNgn: 0,
      isConfirmed: true,
    });

    expect(confirmedHtml).toContain('Credibility Confirmed');
    expect(confirmedHtml).toContain('Chief Emeka Okon');
    expect(confirmedHtml).toContain('Emeka Jr and Somto');
    expect(confirmedHtml).toContain('Pre-Approved for 7:15 AM Cutoff');
    expect(confirmedHtml).toContain('View Live Transport Dashboard');

    // Branch B HTML
    const topupHtml = renderPreFlightAuditEmailHtml({
      parentName: 'Mrs. Folake Adeyemi',
      parentEmail: 'folake@example.com',
      targetDateFormatted: 'Tuesday, 20 October 2026',
      dayLabel: 'Tomorrow',
      childrenNames: 'Bolanle Adeyemi',
      childrenList: [
        { name: 'Bolanle Adeyemi', schoolName: 'St. Saviour\'s School Ikoyi', fareNgn: 1060 },
      ],
      availableBalanceNgn: 500,
      totalRequiredFareNgn: 1060,
      shortfallNgn: 560,
      isConfirmed: false,
    });

    expect(topupHtml).toContain('Top-Up Required for Tomorrow\'s Ride');
    expect(topupHtml).toContain('Mrs. Folake Adeyemi');
    expect(topupHtml).toContain('Top-Up Shortfall Needed');
    expect(topupHtml).toContain('560.00');
    expect(topupHtml).toContain('Fund Wallet Now');
    expect(topupHtml).toContain('shortfall=560');
  }
);
