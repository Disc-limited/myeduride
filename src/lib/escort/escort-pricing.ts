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
  /** ₦ per whole km band (0–1 km, 1–2 km, …) */
  ratePerKm: number;
  /** One-way base before service charge (= billableKm × ratePerKm) */
  baseFarePerTrip: number;
  /** Whole-km bands charged (ceil of distance, min 1) */
  billableKm: number;
  /** @deprecated kept for callers; always 0 under per-km formula */
  halfKmBlocks: number;
  /** @deprecated kept for callers; always 0 under per-km formula */
  remainderTenths: number;
  distanceCharge: number;
  serviceCharge: number;
  serviceChargePercent: number;
  /** Alias of ratePerKm for older metadata writers */
  ratePerHalfKm: number;
  /** Unused under per-km formula (always 0) */
  ratePerTenthKm: number;
  oneWayFare: number;
  formattedDistanceCharge: string;
  formattedServiceCharge: string;
  formattedOneWayFare: string;
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

/** Platform default: ₦500 for every 0–1 km band (one-way base before service). */
export const RATE_PER_KM = 500;
export const SERVICE_CHARGE_PERCENT = 6;

/** @deprecated use RATE_PER_KM — kept so older imports compile */
export const RATE_PER_HALF_KM = RATE_PER_KM;
/** @deprecated unused under per-km formula */
export const RATE_PER_TENTH_KM = 0;

export type EscortFareRateOverrides = {
  rate_per_km?: number;
  /** @deprecated accepted as alias for rate_per_km when migrating city configs */
  rate_per_half_km?: number;
  rate_per_tenth_km?: number;
  service_charge_percent?: number;
};

/**
 * Billable whole-km bands: every 0–1 km counts as 1 band.
 * 0.1–1.0 → 1 · 1.01–2.0 → 2 · etc.
 */
export function billableDistanceKm(distanceKm: number): number {
  const raw = Number(distanceKm);
  const km = Number.isFinite(raw) && raw > 0 ? raw : 1;
  return Math.max(1, Math.ceil(km - 1e-9));
}

function formatNgn(val: number): string {
  return `₦${val.toLocaleString('en-NG')}`;
}

function resolveRatePerKm(rates?: EscortFareRateOverrides): number {
  const fromKm = rates?.rate_per_km;
  if (fromKm != null && Number.isFinite(Number(fromKm)) && Number(fromKm) >= 0) {
    return Number(fromKm);
  }
  // Legacy city configs stored the primary knob in rate_per_half_km
  const legacy = rates?.rate_per_half_km;
  if (legacy != null && Number.isFinite(Number(legacy)) && Number(legacy) > 0) {
    // If value looks like the old half-km rate (300), treat as outdated — use platform default
    // unless it was already updated to 500+ by CM.
    const n = Number(legacy);
    if (n === 300) return RATE_PER_KM;
    return n;
  }
  return RATE_PER_KM;
}

/**
 * Distance base for one trip (before service charge):
 * ₦500 × whole-km bands (0–1 km, 1–2 km, …) or city override.
 */
export function calculateDistanceCharge(
  distanceKm: number,
  rates?: EscortFareRateOverrides
): {
  billableKm: number;
  halfKmBlocks: number;
  remainderTenths: number;
  distanceCharge: number;
  ratePerKm: number;
  ratePerHalfKm: number;
  ratePerTenthKm: number;
} {
  const ratePerKm = resolveRatePerKm(rates);
  const billableKm = billableDistanceKm(distanceKm);
  const distanceCharge = billableKm * ratePerKm;
  return {
    billableKm,
    halfKmBlocks: 0,
    remainderTenths: 0,
    distanceCharge,
    ratePerKm,
    ratePerHalfKm: ratePerKm,
    ratePerTenthKm: 0,
  };
}

/**
 * Formula (Zecomission):
 *   One-Way Fare = Base + 6% Service Charge
 *   Complete Trip = One-Way Fare × 2
 * Base = ₦500 × each 0–1 km band (city-configurable).
 */
export function calculateEscortFare(
  distanceKm: number,
  tripType: 'both' | 'morning_only' | 'afternoon_only' = 'both',
  rates?: EscortFareRateOverrides
): EscortFareBreakdown {
  const { billableKm, halfKmBlocks, remainderTenths, distanceCharge, ratePerKm, ratePerHalfKm, ratePerTenthKm } =
    calculateDistanceCharge(distanceKm, rates);
  const serviceChargePercent = Number(rates?.service_charge_percent ?? SERVICE_CHARGE_PERCENT);
  const serviceCharge = Math.round(distanceCharge * (serviceChargePercent / 100));
  const oneWayFare = distanceCharge + serviceCharge;

  const morningFare = tripType === 'afternoon_only' ? 0 : oneWayFare;
  const afternoonFare = tripType === 'morning_only' ? 0 : oneWayFare;
  const dailyFare = morningFare + afternoonFare;

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
    baseFarePerTrip: distanceCharge,
    billableKm,
    halfKmBlocks,
    remainderTenths,
    distanceCharge,
    serviceCharge,
    serviceChargePercent,
    ratePerHalfKm,
    ratePerTenthKm,
    oneWayFare,
    formattedDistanceCharge: formatNgn(distanceCharge),
    formattedServiceCharge: formatNgn(serviceCharge),
    formattedOneWayFare: formatNgn(oneWayFare),
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
