import { TestSuite, expect } from '../utils/test-harness';
import {
  calculateEscortFare,
  resolveStoredEscortFare,
  normalizeEscortTripType,
  billableDistanceKm,
} from '../../src/lib/escort/escort-pricing';

export const cityPricingSuite = new TestSuite('City Pricing & Shift Manifest Invariants', 'UNIT');

cityPricingSuite.test('City Manager Fare Adjustment: Rates automatically update daily, morning, and afternoon fares', () => {
  const initialRates = { rate_per_km: 500, service_charge_percent: 6 };
  const adjustedRates = { rate_per_km: 700, service_charge_percent: 10 };

  // 4.2 km -> billable 5 km
  const fareBefore = calculateEscortFare(4.2, 'both', initialRates);
  expect(fareBefore.billableKm).toBe(5);
  // Base: 5 * 500 = 2500; Service: 2500 * 0.06 = 150; One-way: 2650; Complete: 5300
  expect(fareBefore.morningFare).toBe(2650);
  expect(fareBefore.afternoonFare).toBe(2650);
  expect(fareBefore.dailyFare).toBe(5300);

  // After City Manager adjustment:
  const fareAfter = calculateEscortFare(4.2, 'both', adjustedRates);
  // Base: 5 * 700 = 3500; Service: 3500 * 0.10 = 350; One-way: 3850; Complete: 7700
  expect(fareAfter.morningFare).toBe(3850);
  expect(fareAfter.afternoonFare).toBe(3850);
  expect(fareAfter.dailyFare).toBe(7700);
});

cityPricingSuite.test('resolveStoredEscortFare applies updated City Manager rates dynamically without stale notes override', () => {
  const activeRates = { rate_per_km: 600, service_charge_percent: 6 };
  
  // Stale notes created with old 300 rate (dailyFare was 3180)
  const staleNotes = {
    daily_fare: 3180,
    morning_fare: 1590,
    afternoon_fare: 1590,
    distance_km: 5.0,
    trip_type: 'both',
  };

  const resolved = resolveStoredEscortFare({
    assignmentNotes: staleNotes,
    notes: staleNotes,
    distanceKm: 5.0,
    tripType: 'both',
    rates: activeRates,
  });

  // Base: 5 * 600 = 3000; Service: 3000 * 0.06 = 180; One-way: 3180; Daily: 6360
  expect(resolved.dailyFare).toBe(6360);
  expect(resolved.morningFare).toBe(3180);
  expect(resolved.afternoonFare).toBe(3180);
  expect(resolved.isDiscounted).toBeFalsy();
});

cityPricingSuite.test('Preserves genuine discounts while updating standard daily baseline', () => {
  const activeRates = { rate_per_km: 600, service_charge_percent: 6 };
  
  const discountedNotes = {
    fare_correction: {
      discountedFare: 4000,
      originalFare: 5000,
      reason: 'School Staff Child Discount',
    },
    distance_km: 5.0,
    trip_type: 'both',
  };

  const resolved = resolveStoredEscortFare({
    assignmentNotes: discountedNotes,
    notes: discountedNotes,
    distanceKm: 5.0,
    tripType: 'both',
    rates: activeRates,
  });

  // Discounted daily must be kept at 4000, but standard daily rebased to 6360
  expect(resolved.dailyFare).toBe(4000);
  expect(resolved.morningFare).toBe(2000);
  expect(resolved.afternoonFare).toBe(2000);
  expect(resolved.standardDailyFare).toBe(6360);
  expect(resolved.isDiscounted).toBeTruthy();
});

cityPricingSuite.test('Multi-Child Daily Fee Aggregation: Computes exact total daily amount across multiple siblings', () => {
  const rates = { rate_per_km: 500, service_charge_percent: 6 };

  const childA = calculateEscortFare(3.0, 'both', rates); // 3 km -> 1500 + 90 = 1590 * 2 = 3180
  const childB = calculateEscortFare(6.2, 'both', rates); // 7 km -> 3500 + 210 = 3710 * 2 = 7420

  const totalDaily = childA.dailyFare + childB.dailyFare;
  const totalMorning = childA.morningFare + childB.morningFare;
  const totalAfternoon = childA.afternoonFare + childB.afternoonFare;

  expect(childA.dailyFare).toBe(3180);
  expect(childB.dailyFare).toBe(7420);
  expect(totalDaily).toBe(10600);
  expect(totalMorning).toBe(5300);
  expect(totalAfternoon).toBe(5300);
});

cityPricingSuite.test('Shift Manifest Invariant: Morning pickup list strictly excludes afternoon-only students', () => {
  const mockStudents = [
    { id: 'S1', name: 'Student 1', trip_type: 'both' },
    { id: 'S2', name: 'Student 2', trip_type: 'afternoon_only' },
    { id: 'S3', name: 'Student 3', trip_type: 'afternoon' },
    { id: 'S4', name: 'Student 4', trip_type: 'morning_only' },
    { id: 'S5', name: 'Student 5', trip_type: 'morning' },
  ];

  const morningManifest = mockStudents.filter((s) => {
    const tt = normalizeEscortTripType(s.trip_type);
    return tt !== 'afternoon_only';
  });

  expect(morningManifest.length).toBe(3);
  expect(morningManifest.map((s) => s.id)).toEqual(['S1', 'S4', 'S5']);
  expect(morningManifest.some((s) => s.id === 'S2')).toBeFalsy();
  expect(morningManifest.some((s) => s.id === 'S3')).toBeFalsy();

  const afternoonManifest = mockStudents.filter((s) => {
    const tt = normalizeEscortTripType(s.trip_type);
    return tt !== 'morning_only';
  });

  expect(afternoonManifest.length).toBe(3);
  expect(afternoonManifest.map((s) => s.id)).toEqual(['S1', 'S2', 'S3']);
  expect(afternoonManifest.some((s) => s.id === 'S4')).toBeFalsy();
  expect(afternoonManifest.some((s) => s.id === 'S5')).toBeFalsy();
});

cityPricingSuite.test('Gate Officer Escort Batch Invariant: Gate officer receives only morning-picked students (5 of 9)', () => {
  // Scenario: 9 students total assigned to escort.
  // 5 students scheduled for morning and picked up at home.
  // 4 students are afternoon-only or were not picked up.
  const assignedStudents = [
    { id: 'STU-1', trip_type: 'both' },
    { id: 'STU-2', trip_type: 'both' },
    { id: 'STU-3', trip_type: 'both' },
    { id: 'STU-4', trip_type: 'morning_only' },
    { id: 'STU-5', trip_type: 'morning_only' },
    { id: 'STU-6', trip_type: 'afternoon_only' },
    { id: 'STU-7', trip_type: 'afternoon_only' },
    { id: 'STU-8', trip_type: 'afternoon_only' },
    { id: 'STU-9', trip_type: 'afternoon_only' },
  ];

  const morningPickedUpIds = new Set(['STU-1', 'STU-2', 'STU-3', 'STU-4', 'STU-5']);
  const arrivalsMap = new Map(); // Not yet checked in at gate

  // Gate Officer Morning Arrival filter
  const gateMorningArrivalList = assignedStudents.filter((st) => {
    const tt = normalizeEscortTripType(st.trip_type);
    if (tt === 'afternoon_only') return false;
    return morningPickedUpIds.has(st.id) && !arrivalsMap.has(st.id);
  });

  expect(gateMorningArrivalList.length).toBe(5);
  expect(gateMorningArrivalList.map((s) => s.id)).toEqual(['STU-1', 'STU-2', 'STU-3', 'STU-4', 'STU-5']);

  // Gate Officer Afternoon Departure filter: all 9 are scheduled for afternoon transit or in school
  const afternoonDeparturesMap = new Map();
  const afternoonOnBoardIds = new Set();
  const afternoonDroppedIds = new Set();

  const gateAfternoonReleaseList = assignedStudents.filter((st) => {
    const tt = normalizeEscortTripType(st.trip_type);
    if (tt === 'morning_only') return false;
    if (afternoonDeparturesMap.has(st.id) || afternoonOnBoardIds.has(st.id) || afternoonDroppedIds.has(st.id)) {
      return false;
    }
    return true;
  });

  // 7 students have afternoon transit (STU-1, STU-2, STU-3, and STU-6..STU-9)
  expect(gateAfternoonReleaseList.length).toBe(7);
  expect(gateAfternoonReleaseList.some((s) => s.id === 'STU-4' || s.id === 'STU-5')).toBeFalsy();
});

cityPricingSuite.test('City Manager Fare Edit Invariant: Afternoon-only (drop-off) input sets morning fare strictly to 0 and afternoon fare to corrected amount', () => {
  const activeRates = { rate_per_km: 600, service_charge_percent: 6 };

  // City Manager edits payment for drop-off only to ₦2,000
  const afternoonOnlyNotes = {
    fare_correction: {
      discountedFare: 2000,
      originalFare: 3500,
      discountReason: 'One-way afternoon trip',
    },
    trip_type: 'afternoon_only',
    distance_km: 5.0,
  };

  const resolved = resolveStoredEscortFare({
    notes: afternoonOnlyNotes,
    distanceKm: 5.0,
    tripType: 'afternoon_only',
    rates: activeRates,
  });

  expect(resolved.tripType).toBe('afternoon_only');
  expect(resolved.dailyFare).toBe(2000);
  expect(resolved.morningFare).toBe(0); // STRICT INVARIANT: Morning MUST be 0
  expect(resolved.afternoonFare).toBe(2000); // STRICT INVARIANT: Afternoon gets full inputted payment
  expect(resolved.formattedMorningFare).toBe('₦0');
  expect(resolved.formattedAfternoonFare).toBe('₦2,000');
});

cityPricingSuite.test('City Manager Fare Edit Invariant: Morning-only (pickup) input sets afternoon fare strictly to 0 and morning fare to corrected amount', () => {
  const activeRates = { rate_per_km: 600, service_charge_percent: 6 };

  // City Manager edits payment for morning pickup only to ₦2,500
  const morningOnlyNotes = {
    fare_correction: {
      discountedFare: 2500,
      originalFare: 3500,
      discountReason: 'One-way morning trip',
    },
    trip_type: 'morning_only',
    distance_km: 5.0,
  };

  const resolved = resolveStoredEscortFare({
    notes: morningOnlyNotes,
    distanceKm: 5.0,
    tripType: 'morning_only',
    rates: activeRates,
  });

  expect(resolved.tripType).toBe('morning_only');
  expect(resolved.dailyFare).toBe(2500);
  expect(resolved.morningFare).toBe(2500); // Morning gets full inputted payment
  expect(resolved.afternoonFare).toBe(0); // STRICT INVARIANT: Afternoon MUST be 0
  expect(resolved.formattedMorningFare).toBe('₦2,500');
  expect(resolved.formattedAfternoonFare).toBe('₦0');
});

async function run() {
  await cityPricingSuite.run();
}

run();
