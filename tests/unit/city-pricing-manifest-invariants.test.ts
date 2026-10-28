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

cityPricingSuite.test('City Manager vs Escort Fare Differentiation: Escort receives Approved Km Fare while CM separates Km Fare from Service Charge', () => {
  const rates = { rate_per_km: 500, service_charge_percent: 6 };

  // 4.2 km corridor -> 5 billable km
  const fare = calculateEscortFare(4.2, 'both', rates);

  // Billable km verification
  expect(fare.billableKm).toBe(5);

  // 1. Approved Km Fare (Strictly Escort View)
  expect(fare.dailyKmFare).toBe(5000); // 5km * ₦500 * 2 trips
  expect(fare.morningKmFare).toBe(2500);
  expect(fare.afternoonKmFare).toBe(2500);
  expect(fare.formattedDailyKmFare).toBe('₦5,000');

  // 2. Service Charge (Platform Fee, CM Differentiated)
  expect(fare.dailyServiceCharge).toBe(300); // 6% of 5000
  expect(fare.morningServiceCharge).toBe(150);
  expect(fare.afternoonServiceCharge).toBe(150);

  // 3. Parent Gross Total Fare
  expect(fare.dailyFare).toBe(5300); // 5000 km fare + 300 service charge
  expect(fare.morningFare).toBe(2650);
  expect(fare.afternoonFare).toBe(2650);
});

cityPricingSuite.test('Driver Net Compensation Invariant: 80% to driver, 20% platform levy from Approved Km Fare', () => {
  const rates = { rate_per_km: 500, service_charge_percent: 6 };

  // Complete round trip for 5 billable km
  const fare = calculateEscortFare(5, 'both', rates);

  // Approved Km Fare = 5 * 500 * 2 = 5000
  expect(fare.dailyKmFare).toBe(5000);

  // 80% Driver Net Share = ₦4,000
  expect(fare.driverDailyEarnings).toBe(4000);
  expect(fare.driverMorningEarnings).toBe(2000);
  expect(fare.driverAfternoonEarnings).toBe(2000);
  expect(fare.formattedDriverDailyEarnings).toBe('₦4,000');

  // 20% Platform Levy = ₦1,000
  expect(fare.platformDailyLevy).toBe(1000);
  expect(fare.formattedPlatformDailyLevy).toBe('₦1,000');

  // Platform Total = 20% Km Levy (1000) + Service Charge (300) = ₦1,300
  expect(fare.platformDailyTotal).toBe(1300);
  expect(fare.formattedPlatformDailyTotal).toBe('₦1,300');

  // Financial Invariant Conservation: Driver Share (4000) + Platform Total (1300) === Gross Parent Fare (5300)
  expect(fare.driverDailyEarnings + fare.platformDailyTotal).toBe(fare.dailyFare);
});

cityPricingSuite.test('One-way trip 80/20 driver net allocation matches trip direction strictly', () => {
  const rates = { rate_per_km: 600, service_charge_percent: 6 };

  // Afternoon only for 4 km -> Km Fare = 4 * 600 = 2400
  const fare = calculateEscortFare(4, 'afternoon_only', rates);

  expect(fare.dailyKmFare).toBe(2400);
  expect(fare.morningKmFare).toBe(0);
  expect(fare.afternoonKmFare).toBe(2400);

  // 80% Driver share = 2400 * 0.8 = 1920
  expect(fare.driverDailyEarnings).toBe(1920);
  expect(fare.driverMorningEarnings).toBe(0);
  expect(fare.driverAfternoonEarnings).toBe(1920);

  // 20% Platform levy = 2400 * 0.2 = 480
  expect(fare.platformDailyLevy).toBe(480);
});

cityPricingSuite.test('resolveStoredEscortFare computes 80/20 split on dynamic and discounted rates', () => {
  const rates = { rate_per_km: 500, service_charge_percent: 6 };

  const resolved = resolveStoredEscortFare({
    distanceKm: 3.0,
    tripType: 'both',
    rates,
  });

  // 3 km -> Km fare: 3 * 500 * 2 = 3000
  expect(resolved.dailyKmFare).toBe(3000);
  expect(resolved.driverDailyEarnings).toBe(2400); // 80% of 3000
  expect(resolved.platformDailyLevy).toBe(600); // 20% of 3000
  expect(resolved.dailyServiceCharge).toBe(180); // 6% of 3000
});

async function run() {
  await cityPricingSuite.run();
}

run();
