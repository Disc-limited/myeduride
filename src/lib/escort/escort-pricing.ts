// @ts-nocheck
import { calculateHaversineDistance } from '@/lib/types/tracking-types';

export interface EscortDistanceResult {
  distanceKm: number;
  distanceMeters: number;
  isExactCoordinate: boolean;
  notes: string;
}

export interface EscortFareBreakdown {
  tripType: 'both' | 'morning_only' | 'afternoon_only';
  morningFare: number;
  afternoonFare: number;
  dailyFare: number;
  currency: string;
  formattedMorningFare: string;
  formattedAfternoonFare: string;
  formattedDailyFare: string;
  ratePerKm: number;
  baseFarePerTrip: number;
  billableKm: number;
  halfKmBlocks: number;
  remainderTenths: number;
  distanceCharge: number;
  serviceCharge: number;
  serviceChargePercent: number;
  ratePerHalfKm: number;
  ratePerTenthKm: number;
  formattedDistanceCharge: string;
  formattedServiceCharge: string;
}

/**
 * Calculates geographic distance in kilometers between school coordinates and student doorstep coordinates.
 * Falls back gracefully to reasonable default estimates if coordinates have not yet been pinned.
 */
export function calculateSchoolToHomeDistance(
  school: { gps_lat?: number | string | null; gps_lng?: number | string | null; address?: string | null },
  student: { house_lat?: number | string | null; house_lng?: number | string | null; house_address?: string | null; address?: string | null }
): EscortDistanceResult {
  const schoolLat = school?.gps_lat != null ? Number(school.gps_lat) : null;
  const schoolLng = school?.gps_lng != null ? Number(school.gps_lng) : null;
  const studentLat = student?.house_lat != null ? Number(student.house_lat) : null;
  const studentLng = student?.house_lng != null ? Number(student.house_lng) : null;

  if (
    schoolLat != null &&
    schoolLng != null &&
    studentLat != null &&
    studentLng != null &&
    !isNaN(schoolLat) &&
    !isNaN(schoolLng) &&
    !isNaN(studentLat) &&
    !isNaN(studentLng)
  ) {
    const meters = calculateHaversineDistance(schoolLat, schoolLng, studentLat, studentLng);
    // Add 25% road-curvature factor to direct great-circle distance for realistic driving routing
    const roadMeters = meters * 1.25;
    const distanceKm = Math.max(0.5, Number((roadMeters / 1000).toFixed(1)));
    return {
      distanceKm,
      distanceMeters: Math.round(roadMeters),
      isExactCoordinate: true,
      notes: `GPS Doorstep Pinned (${distanceKm} km turn-by-turn estimate)`,
    };
  }

  // Graceful fallback when coordinates are not yet pinned
  const defaultKm = 5.0;
  return {
    distanceKm: defaultKm,
    distanceMeters: defaultKm * 1000,
    isExactCoordinate: false,
    notes: 'Default Area Zone Distance (House GPS location not yet pinned by parent)',
  };
}

export const RATE_PER_HALF_KM = 300;
export const RATE_PER_TENTH_KM = 30;
export const SERVICE_CHARGE_PERCENT = 6;

export type EscortFareRateOverrides = {
  rate_per_half_km?: number;
  rate_per_tenth_km?: number;
  service_charge_percent?: number;
};

export function billableDistanceKm(distanceKm: number): number {
  const raw = Number(distanceKm);
  const km = Number.isFinite(raw) && raw > 0 ? raw : 0.5;
  const tenths = Math.ceil(km * 10 - 1e-9) / 10;
  return Math.max(0.5, Number(tenths.toFixed(1)));
}

function formatNgn(val: number): string {
  return `₦${val.toLocaleString('en-NG')}`;
}

/**
 * Distance charge for one trip:
 * - ₦300 for every complete 0.5 km (or city override)
 * - ₦30 for every extra 0.1 km (or city override)
 * Then service charge % is added for the parent-facing total.
 */
export function calculateDistanceCharge(
  distanceKm: number,
  rates?: EscortFareRateOverrides
): {
  billableKm: number;
  halfKmBlocks: number;
  remainderTenths: number;
  distanceCharge: number;
  ratePerHalfKm: number;
  ratePerTenthKm: number;
} {
  const ratePerHalfKm = Number(rates?.rate_per_half_km ?? RATE_PER_HALF_KM);
  const ratePerTenthKm = Number(rates?.rate_per_tenth_km ?? RATE_PER_TENTH_KM);
  const billableKm = billableDistanceKm(distanceKm);
  const halfKmBlocks = Math.floor(billableKm / 0.5 + 1e-9);
  const remainderKm = Number((billableKm - halfKmBlocks * 0.5).toFixed(1));
  const remainderTenths = Math.round(remainderKm * 10);
  const distanceCharge = halfKmBlocks * ratePerHalfKm + remainderTenths * ratePerTenthKm;
  return { billableKm, halfKmBlocks, remainderTenths, distanceCharge, ratePerHalfKm, ratePerTenthKm };
}

/**
 * Calculates escort booking fare based on distance and trip schedule.
 * Optional rates override uses per-city City Manager pricing when provided.
 */
export function calculateEscortFare(
  distanceKm: number,
  tripType: 'both' | 'morning_only' | 'afternoon_only' = 'both',
  rates?: EscortFareRateOverrides
): EscortFareBreakdown {
  const {
    billableKm,
    halfKmBlocks,
    remainderTenths,
    distanceCharge,
    ratePerHalfKm,
    ratePerTenthKm,
  } = calculateDistanceCharge(distanceKm, rates);
  const serviceChargePercent = Number(rates?.service_charge_percent ?? SERVICE_CHARGE_PERCENT);
  const serviceCharge = Math.round(distanceCharge * (serviceChargePercent / 100));
  const singleTripFare = distanceCharge + serviceCharge;

  const morningFare = tripType === 'afternoon_only' ? 0 : singleTripFare;
  const afternoonFare = tripType === 'morning_only' ? 0 : singleTripFare;
  const dailyFare = morningFare + afternoonFare;

  const ratePerKm = ratePerHalfKm / 0.5;
  const baseFarePerTrip = ratePerHalfKm;

  return {
    tripType,
    morningFare,
    afternoonFare,
    dailyFare,
    currency: 'NGN',
    formattedMorningFare: formatNgn(morningFare),
    formattedAfternoonFare: formatNgn(afternoonFare),
    formattedDailyFare: formatNgn(dailyFare),
    ratePerKm,
    baseFarePerTrip,
    billableKm,
    halfKmBlocks,
    remainderTenths,
    distanceCharge,
    serviceCharge,
    serviceChargePercent,
    ratePerHalfKm,
    ratePerTenthKm,
    formattedDistanceCharge: formatNgn(distanceCharge),
    formattedServiceCharge: formatNgn(serviceCharge),
  };
}

export function parseEscortNotes(notes: unknown): Record<string, any> {
  if (!notes) return {};
  if (typeof notes === 'object' && notes !== null) return notes as Record<string, any>;
  const raw = String(notes).trim();
  if (!raw.startsWith('{')) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function normalizeEscortTripType(raw?: string | null): 'both' | 'morning_only' | 'afternoon_only' {
  if (raw === 'afternoon' || raw === 'afternoon_only') return 'afternoon_only';
  if (raw === 'morning' || raw === 'morning_only') return 'morning_only';
  return 'both';
}

export function resolveStoredEscortFare(input: {
  fareAmount?: number | string | null;
  notes?: unknown;
  assignmentNotes?: unknown;
  distanceKm?: number | string | null;
  tripType?: string | null;
  rates?: EscortFareRateOverrides;
}) {
  const meta = parseEscortNotes(input.notes);
  const assignMeta = parseEscortNotes(input.assignmentNotes);
  const tripType = normalizeEscortTripType(
    input.tripType || meta.trip_type || assignMeta.trip_type || meta.fareResult?.tripType
  );
  const distanceKm = Number(input.distanceKm || meta.distance_km || assignMeta.distance_km || 4.5) || 4.5;
  const engine = calculateEscortFare(distanceKm, tripType, input.rates);

  // Prefer the newest City Manager fare_correction / discount by appliedAt
  const correctionCandidates = [
    meta.fare_correction,
    assignMeta.fare_correction,
    meta.discount,
    assignMeta.discount,
  ].filter((c) => c && (c.discountedFare != null || c.originalFare != null));
  const storedDiscount =
    correctionCandidates.sort(
      (a, b) => Date.parse(String(b.appliedAt || 0)) - Date.parse(String(a.appliedAt || 0))
    )[0] || null;

  // Assignment notes are what the escort portal reads after CM correction — prefer them over
  // a stale booking fareResult / fare_amount when no dated correction is present.
  const assignStoredDaily = Number(
    assignMeta?.fare_correction?.discountedFare ||
      assignMeta?.discount?.discountedFare ||
      assignMeta?.fareResult?.dailyFare ||
      assignMeta?.daily_fare ||
      assignMeta?.actual_amount_collected ||
      0
  );
  const bookingStoredDaily = Number(
    meta?.fare_correction?.discountedFare ||
      meta?.discount?.discountedFare ||
      meta?.fareResult?.dailyFare ||
      meta?.daily_fare ||
      meta?.actual_amount_collected ||
      input.fareAmount ||
      0
  );

  const storedDaily = Number(
    (storedDiscount?.discountedFare != null && Number(storedDiscount.discountedFare) > 0
      ? storedDiscount.discountedFare
      : 0) ||
      (assignStoredDaily > 0 ? assignStoredDaily : 0) ||
      bookingStoredDaily ||
      0
  );

  const standardDaily = Number(
    storedDiscount?.originalFare ||
      meta?.fare_correction?.originalFare ||
      assignMeta?.fare_correction?.originalFare ||
      meta?.fareResult?.originalDailyFare ||
      assignMeta?.fareResult?.originalDailyFare ||
      engine.dailyFare
  );
  const dailyFare = storedDaily > 0 ? storedDaily : engine.dailyFare;
  const usedStored = storedDaily > 0;
  const morningFare = usedStored
    ? Number(
        (storedDiscount && assignMeta?.fare_correction === storedDiscount
          ? assignMeta?.fareResult?.morningFare || assignMeta?.morning_fare
          : null) ||
          assignMeta?.fareResult?.morningFare ||
          assignMeta?.morning_fare ||
          meta?.fareResult?.morningFare ||
          meta?.morning_fare ||
          (tripType === 'afternoon_only' ? 0 : tripType === 'morning_only' ? dailyFare : Math.round(dailyFare / 2))
      )
    : engine.morningFare;
  const afternoonFare = usedStored
    ? Number(
        assignMeta?.fareResult?.afternoonFare ||
          assignMeta?.afternoon_fare ||
          meta?.fareResult?.afternoonFare ||
          meta?.afternoon_fare ||
          (tripType === 'morning_only' ? 0 : dailyFare - morningFare)
      )
    : engine.afternoonFare;

  return {
    ...engine,
    tripType,
    distanceKm,
    morningFare,
    afternoonFare,
    dailyFare,
    standardDailyFare: standardDaily,
    actualAmountCollected: dailyFare,
    isDiscounted: Boolean(storedDiscount) || (standardDaily > 0 && dailyFare < standardDaily),
    discountDetails: storedDiscount,
    usedStoredFare: usedStored,
    formattedMorningFare: formatNgn(morningFare),
    formattedAfternoonFare: formatNgn(afternoonFare),
    formattedDailyFare: formatNgn(dailyFare),
  };
}
