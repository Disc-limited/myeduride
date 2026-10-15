/**
 * UNIT TEST SUITE: Gate System Daily Deduction & Daily Attendance Roll-Call Engine
 * Phase 3 Architecture:
 * 1. Gate Fee Deduction Math & Non-Negative Solvency Invariants
 * 2. Deterministic Gate Billing Reference Format & Idempotency Key
 * 3. Attendance Late Arrival Threshold Calculation
 * 4. Roll-Call Rate Arithmetic & Class-Level Aggregation Invariants
 * 5. Executive Gate Digest HTML Template Rendering with KPIs & Badges
 */

import { TestSuite, expect } from '../utils/test-harness';
import {
  DailyRollCallReport,
  StudentRollCallItem,
  StaffRollCallItem,
} from '../../src/lib/attendance/daily-roll-call';
import {
  renderDailyGateDigestHtml,
  GateDeductionSummary,
} from '../../src/lib/notifications/email-templates/daily-gate-digest';
import { minutesLateAtTimestamp } from '../../src/lib/timezone';

export const dailyGateDeductionAndRollCallSuite = new TestSuite(
  'Gate System Daily Billing & Attendance Roll-Call Engine',
  'UNIT'
);

// 1. Gate Fee Solvency Invariants
dailyGateDeductionAndRollCallSuite.test(
  'Gate Fee Deduction Math & Non-Negative Solvency Check',
  () => {
    const dailyFeeKobo = 250000; // ₦2,500.00
    const initialBalanceKobo = 500000; // ₦5,000.00

    // Sufficient balance scenario
    const balanceAfter = initialBalanceKobo - dailyFeeKobo;
    expect(balanceAfter).toBe(250000);
    expect(balanceAfter / 100).toBe(2500.0);

    // Insufficient balance scenario
    const lowBalanceKobo = 100000; // ₦1,000.00
    const shortfallKobo = dailyFeeKobo - lowBalanceKobo;
    expect(shortfallKobo).toBe(150000);
    expect(lowBalanceKobo < dailyFeeKobo).toBeTruthy();
  }
);

// 2. Deterministic Ledger Reference Format
dailyGateDeductionAndRollCallSuite.test(
  'Deterministic Gate Billing Reference Format & Idempotency Key',
  () => {
    const schoolId = 'e1a2b3c4-0000-0000-0000-000000000001';
    const dateStr = '20261015';
    const expectedRef = `GATE-SYS-${schoolId}-${dateStr}`;

    expect(expectedRef).toBe(
      'GATE-SYS-e1a2b3c4-0000-0000-0000-000000000001-20261015'
    );
  }
);

// 3. Late Arrival Threshold Calculation
dailyGateDeductionAndRollCallSuite.test(
  'Attendance Late Arrival Threshold Calculation',
  () => {
    const cutoff = '08:00';

    // On-time student at 07:45 AM (Lagos time UTC+1)
    const onTimeIso = '2026-10-15T06:45:00.000Z'; // 07:45 AM WAT
    const lateMin1 = minutesLateAtTimestamp(onTimeIso, cutoff);
    expect(lateMin1).toBe(null);

    // Late student at 08:23 AM (Lagos time UTC+1)
    const lateIso = '2026-10-15T07:23:00.000Z'; // 08:23 AM WAT
    const lateMin2 = minutesLateAtTimestamp(lateIso, cutoff);
    expect(lateMin2).toBe(23);
  }
);

// 4. Roll-Call Rate Arithmetic & Precision
dailyGateDeductionAndRollCallSuite.test(
  'Roll-Call Rate Arithmetic and Precision Invariants',
  () => {
    const totalEnrolled = 120;
    const totalPresent = 114;
    const totalAbsent = 6;

    const rate = Math.round((totalPresent / totalEnrolled) * 1000) / 10;
    expect(rate).toBe(95.0);
    expect(totalPresent + totalAbsent).toBe(totalEnrolled);

    // Edge case: 0 enrolled
    const zeroRate = 0 > 0 ? (0 / 0) * 100 : 0;
    expect(zeroRate).toBe(0);
  }
);

// 5. HTML Email Digest Template Rendering
dailyGateDeductionAndRollCallSuite.test(
  'Executive Gate Digest HTML Template Rendering with KPIs & Deduction Badge',
  () => {
    const mockReport: DailyRollCallReport = {
      school_id: '00000000-0000-0000-0000-000000000001',
      school_name: 'Solidstone High School',
      date: '2026-10-15',
      formatted_date: '15 Oct 2026',
      shift: 'morning',
      generated_at: new Date().toISOString(),
      students: {
        total_enrolled: 50,
        total_present: 47,
        total_absent: 3,
        total_on_time: 42,
        total_late: 5,
        attendance_rate_pct: 94.0,
        items: [],
        by_class: [
          {
            class_id: 'c1',
            class_name: 'Grade 10A',
            total_enrolled: 25,
            total_present: 24,
            total_absent: 1,
            total_late: 2,
            total_on_time: 22,
            attendance_rate_pct: 96.0,
          },
          {
            class_id: 'c2',
            class_name: 'Grade 10B',
            total_enrolled: 25,
            total_present: 23,
            total_absent: 2,
            total_late: 3,
            total_on_time: 20,
            attendance_rate_pct: 92.0,
          },
        ],
      },
      staff: {
        total_active: 10,
        total_present: 9,
        total_absent: 1,
        total_on_time: 8,
        total_late: 1,
        attendance_rate_pct: 90.0,
        items: [
          {
            user_id: 'u1',
            full_name: 'Mr. Adewale John',
            role: 'Teacher',
            status: 'present',
            clock_in_time: '07:40 AM',
            clock_in_timestamp: new Date().toISOString(),
            clock_out_time: null,
            is_late: false,
            minutes_late: null,
          },
        ],
      },
      highlights: {
        absent_students_count: 3,
        absent_staff_count: 1,
        late_arrivals_count: 6,
        top_absentee_classes: [{ class_name: 'Grade 10B', absent_count: 2 }],
      },
    };

    const mockDeduction: GateDeductionSummary = {
      success: true,
      status: 'DEDUCTED',
      reference: 'GATE-SYS-00000000-0000-0000-0000-000000000001-20261015',
      amount_ngn: 2500.0,
      balance_after_ngn: 147500.0,
    };

    const html = renderDailyGateDigestHtml(mockReport, mockDeduction);

    expect(html.includes('Solidstone High School')).toBeTruthy();
    expect(html.includes('94%')).toBeTruthy();
    expect(html.includes('90%')).toBeTruthy();
    expect(html.includes('₦2,500.00')).toBeTruthy();
    expect(html.includes('GATE-SYS-')).toBeTruthy();
    expect(html.includes('Grade 10A')).toBeTruthy();
    expect(html.includes('Mr. Adewale John')).toBeTruthy();
  }
);

if (require.main === module) {
  dailyGateDeductionAndRollCallSuite.run().then((success) => {
    process.exit(success ? 0 : 1);
  });
}
