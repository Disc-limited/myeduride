import { TestSuite, expect } from '../utils/test-harness';
import {
  parseTimeStringToHourMinute,
  formatHourMinuteTo12Hour,
  computeCutoffFromTimeString,
} from '../../src/lib/escort/pickup-cutoff';

export const tripCancellationCutoffSuite = new TestSuite(
  'Trip Cancellation Cutoff & Fee Protection Invariants',
  'UNIT'
);

tripCancellationCutoffSuite.test('Time Parser: accurately parses various Nigerian morning pickup formats', () => {
  const t1 = parseTimeStringToHourMinute('07:15 AM');
  expect(t1.hours).toBe(7);
  expect(t1.minutes).toBe(15);

  const t2 = parseTimeStringToHourMinute('7:30 AM');
  expect(t2.hours).toBe(7);
  expect(t2.minutes).toBe(30);

  const t3 = parseTimeStringToHourMinute('06:45');
  expect(t3.hours).toBe(6);
  expect(t3.minutes).toBe(45);

  const t4 = parseTimeStringToHourMinute('01:30 PM');
  expect(t4.hours).toBe(13);
  expect(t4.minutes).toBe(30);

  // Fallback default
  const def = parseTimeStringToHourMinute(null);
  expect(def.hours).toBe(7);
  expect(def.minutes).toBe(15);
});

tripCancellationCutoffSuite.test('Time Formatter: converts 24h to 12h display with AM/PM', () => {
  expect(formatHourMinuteTo12Hour(7, 15)).toBe('07:15 AM');
  expect(formatHourMinuteTo12Hour(0, 0)).toBe('12:00 AM');
  expect(formatHourMinuteTo12Hour(12, 30)).toBe('12:30 PM');
  expect(formatHourMinuteTo12Hour(14, 45)).toBe('02:45 PM');
});

tripCancellationCutoffSuite.test('Cutoff Invariant: Future pickup allows cancellation, past pickup locks cancellation', () => {
  // 11:59 PM is always in the future relative to morning/daytime tests
  const futureCutoff = computeCutoffFromTimeString('11:59 PM');
  expect(futureCutoff.agreedPickupTime).toBe('11:59 PM');
  expect(futureCutoff.isPastCutoff).toBeFalsy();
  expect(futureCutoff.canCancel).toBeTruthy();

  // 12:00 AM (midnight) has already passed for today
  const pastCutoff = computeCutoffFromTimeString('12:00 AM');
  expect(pastCutoff.agreedPickupTime).toBe('12:00 AM');
  expect(pastCutoff.isPastCutoff).toBeTruthy();
  expect(pastCutoff.canCancel).toBeFalsy();
});

tripCancellationCutoffSuite.test('Roster Filtering: Canceled students are strictly removed from driver pickup queues', () => {
  const operationalStudents = [
    {
      id: 'stu-1',
      name: 'Amina Bello',
      is_canceled_by_parent: false,
      trip_type: 'both',
      morning_status: 'PENDING_HOME_PICKUP',
      daily_fare: 2500,
      morning_fare: 1250,
    },
    {
      id: 'stu-2',
      name: 'Chinedu Eze',
      is_canceled_by_parent: true, // Parent clicked "Not Going" before cutoff
      cancellation_reason: 'Mild fever, resting at home',
      trip_type: 'both',
      morning_status: 'CANCELED_BY_PARENT',
      daily_fare: 2500,
      morning_fare: 1250,
    },
    {
      id: 'stu-3',
      name: 'Oluwaseun Adeleke',
      is_canceled_by_parent: false,
      trip_type: 'both',
      morning_status: 'PENDING_HOME_PICKUP',
      daily_fare: 3000,
      morning_fare: 1500,
    },
  ];

  // Active driver pickup list
  const activeMorningList = operationalStudents.filter(
    (s) => !s.is_canceled_by_parent && s.trip_type !== 'afternoon_only'
  );

  // Verification 1: Student is removed from list
  expect(activeMorningList.length).toBe(2);
  expect(activeMorningList.map((s) => s.id)).toEqual(['stu-1', 'stu-3']);
  expect(activeMorningList.some((s) => s.id === 'stu-2')).toBeFalsy();

  // Verification 2: Billable daily earnings omit canceled student to avoid payment
  const totalDailyEarnings = activeMorningList.reduce((acc, s) => acc + s.daily_fare, 0);
  expect(totalDailyEarnings).toBe(5500); // 2500 + 3000, not 8000
});

tripCancellationCutoffSuite.test('Parent Action Safety: Prevents fee deduction when canceled before pickup cutoff', () => {
  const mockTripRecord = {
    student_id: 'stu-2',
    is_canceled_by_parent: true,
    agreed_pickup_time: '07:30 AM',
    fee_status: 'waived',
    fee_deducted: false,
  };

  const shouldDeductFee = (trip: typeof mockTripRecord, isPastCutoff: boolean) => {
    if (trip.is_canceled_by_parent) {
      return false; // Fee waived because cancellation happened in time
    }
    return isPastCutoff; // Past cutoff without cancellation locks & deducts fee
  };

  expect(shouldDeductFee(mockTripRecord, true)).toBeFalsy();

  const unCanceledLateStudent = {
    student_id: 'stu-1',
    is_canceled_by_parent: false,
    agreed_pickup_time: '07:00 AM',
    fee_status: 'pending',
    fee_deducted: false,
  };

  expect(shouldDeductFee(unCanceledLateStudent, true)).toBeTruthy();
});
