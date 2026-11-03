import { TestSuite, expect } from '../utils/test-harness';

export const daisafSpecHarmonizationSuite = new TestSuite(
  'Daisaf Wallet Specification Harmonization Invariants (Phase 1)',
  'UNIT'
);

// 1. Gate Pay-As-You-Go Invariant: ₦3 (300 Kobo) Per Scan & Zero Float Drift
daisafSpecHarmonizationSuite.test(
  'Test 1: Gate Scan Pricing — ₦3 in and ₦3 out equals exact integer kobo without rounding error',
  () => {
    const SCAN_FEE_KOBO = 300; // ₦3.00
    const scansIn = 100;
    const scansOut = 100;

    const totalScans = scansIn + scansOut;
    const totalSpentKobo = totalScans * SCAN_FEE_KOBO;
    const totalSpentNgn = totalSpentKobo / 100;

    expect(totalSpentKobo).toBe(60000); // ₦600.00
    expect(totalSpentNgn).toBe(600);

    // 2% Service charge on ₦600 = ₦12 (1,200 kobo)
    const serviceChargeKobo = Math.round((totalSpentKobo * 2) / 100);
    const totalDeductionKobo = totalSpentKobo + serviceChargeKobo;

    expect(serviceChargeKobo).toBe(1200); // ₦12.00
    expect(totalDeductionKobo).toBe(61200); // ₦612.00
    expect(totalDeductionKobo / 100).toBe(612);
  }
);

// 2. School Escort Pay-As-You-Go Invariant: ₦25 Pickup + ₦25 Drop-off = ₦50/Day
daisafSpecHarmonizationSuite.test(
  'Test 2: School Escort Pricing — ₦25 pickup and ₦25 dropoff equals ₦50 per student/day with 2% service charge',
  () => {
    const PICKUP_FEE_KOBO = 2500; // ₦25.00
    const DROPOFF_FEE_KOBO = 2500; // ₦25.00
    const DAILY_FEE_KOBO = PICKUP_FEE_KOBO + DROPOFF_FEE_KOBO;

    expect(DAILY_FEE_KOBO).toBe(5000); // ₦50.00

    const studentsCount = 50;
    const totalSpentKobo = studentsCount * DAILY_FEE_KOBO;
    const serviceChargeKobo = Math.round((totalSpentKobo * 2) / 100);
    const totalDeductionKobo = totalSpentKobo + serviceChargeKobo;

    expect(totalSpentKobo).toBe(250000); // ₦2,500.00
    expect(serviceChargeKobo).toBe(5000); // ₦50.00
    expect(totalDeductionKobo).toBe(255000); // ₦2,550.00
    expect(totalDeductionKobo / 100).toBe(2550);
  }
);

// 3. School Minimum Deposit Invariant: ₦10,000 (1,000,000 Kobo)
daisafSpecHarmonizationSuite.test(
  'Test 3: School Funding Threshold — Rejects deposits below ₦10,000 minimum threshold for gate manager',
  () => {
    const MIN_SCHOOL_FUNDING_KOBO = 1000000; // ₦10,000.00

    function validateSchoolFunding(amountNgn: number): boolean {
      const amountKobo = Math.round(amountNgn * 100);
      return amountKobo >= MIN_SCHOOL_FUNDING_KOBO;
    }

    expect(validateSchoolFunding(5000)).toBe(false);
    expect(validateSchoolFunding(9999)).toBe(false);
    expect(validateSchoolFunding(9999.99)).toBe(false);
    expect(validateSchoolFunding(10000)).toBe(true);
    expect(validateSchoolFunding(50000)).toBe(true);
  }
);

// 4. Delay Penalty Invariant: 2 min grace + 1 min scan buffer, then ₦50/min into Escrow
daisafSpecHarmonizationSuite.test(
  'Test 4: Delay Penalty Engine — 3-minute grace threshold before applying ₦50/minute penalty',
  () => {
    const PENALTY_RATE_PER_MIN_KOBO = 5000; // ₦50.00

    function computeDelayPenalty(arrivalIso: string, boardedIso: string): {
      delayMinutes: number;
      penaltyKobo: number;
      penaltyNgn: number;
    } {
      const arrival = new Date(arrivalIso).getTime();
      const boarded = new Date(boardedIso).getTime();

      // Grace period = 2 mins + 1 min scan = 3 mins (180,000 ms)
      const penaltyThreshold = arrival + 3 * 60 * 1000;

      if (boarded <= penaltyThreshold) {
        return { delayMinutes: 0, penaltyKobo: 0, penaltyNgn: 0 };
      }

      const overdueMs = boarded - penaltyThreshold;
      const delayMinutes = Math.ceil(overdueMs / (60 * 1000));
      const penaltyKobo = delayMinutes * PENALTY_RATE_PER_MIN_KOBO;

      return {
        delayMinutes,
        penaltyKobo,
        penaltyNgn: penaltyKobo / 100,
      };
    }

    const tArrival = '2026-10-30T07:15:00.000Z';

    // Scenario A: Boarded at 2 minutes (Within grace)
    const t2Min = '2026-10-30T07:17:00.000Z';
    expect(computeDelayPenalty(tArrival, t2Min).penaltyKobo).toBe(0);

    // Scenario B: Boarded at 2 mins 55 secs (Within 3 min grace + scan window)
    const t3Min = '2026-10-30T07:17:55.000Z';
    expect(computeDelayPenalty(tArrival, t3Min).penaltyKobo).toBe(0);

    // Scenario C: Boarded at 5 minutes (2 minutes late after 3-min threshold)
    const t5Min = '2026-10-30T07:20:00.000Z';
    const penalty5 = computeDelayPenalty(tArrival, t5Min);
    expect(penalty5.delayMinutes).toBe(2);
    expect(penalty5.penaltyKobo).toBe(10000); // ₦100.00
    expect(penalty5.penaltyNgn).toBe(100);

    // Scenario D: Boarded at 7 minutes (4 minutes late after 3-min threshold)
    const t7Min = '2026-10-30T07:22:00.000Z';
    const penalty7 = computeDelayPenalty(tArrival, t7Min);
    expect(penalty7.delayMinutes).toBe(4);
    expect(penalty7.penaltyKobo).toBe(20000); // ₦200.00
    expect(penalty7.penaltyNgn).toBe(200);
  }
);

// 5. GPS Geofence Verification Invariant (Haversine formula within 150m)
daisafSpecHarmonizationSuite.test(
  'Test 5: GPS Proximity — Accurately validates escort coordinates against parent house within 150m geofence',
  () => {
    function calculateDistanceMeters(
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number
    ): number {
      const R = 6371e3; // Earth radius in meters
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    const parentHouse = { lat: 6.524379, lng: 3.379206 }; // Lagos Yaba location

    // Escort at doorstep (approx 25 meters away)
    const escortAtDoorstep = { lat: 6.524450, lng: 3.379350 };
    const distDoorstep = calculateDistanceMeters(
      parentHouse.lat,
      parentHouse.lng,
      escortAtDoorstep.lat,
      escortAtDoorstep.lng
    );
    expect(distDoorstep <= 150).toBe(true);

    // Escort 500 meters away (stuck in traffic)
    const escortFarAway = { lat: 6.528000, lng: 3.382000 };
    const distFar = calculateDistanceMeters(
      parentHouse.lat,
      parentHouse.lng,
      escortFarAway.lat,
      escortFarAway.lng
    );
    expect(distFar > 150).toBe(true);
  }
);
