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

/**
 * Calculates escort booking fare based on distance and trip schedule.
 * Pricing model:
 * - Base Fare: ₦800 per single trip.
 * - Distance Rate: ₦150 per km.
 * - Minimum Fare: ₦1,000 per single trip.
 * - Both Trips: Morning + Afternoon fare.
 */
export function calculateEscortFare(
  distanceKm: number,
  tripType: 'both' | 'morning_only' | 'afternoon_only' = 'both'
): EscortFareBreakdown {
  const validKm = Math.max(0.5, Number(distanceKm) || 5.0);
  const baseFarePerTrip = 800;
  const ratePerKm = 150;

  // Single trip calculation rounded to nearest 50 Naira
  const rawSingleFare = baseFarePerTrip + validKm * ratePerKm;
  const singleTripFare = Math.max(1000, Math.round(rawSingleFare / 50) * 50);

  const morningFare = tripType === 'afternoon_only' ? 0 : singleTripFare;
  const afternoonFare = tripType === 'morning_only' ? 0 : singleTripFare;
  const dailyFare = morningFare + afternoonFare;

  const formatNgn = (val: number) => `₦${val.toLocaleString('en-NG')}`;

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
  };
}
