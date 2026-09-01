/**
 * Core Real-Time Vehicle & Escort Tracking Types and Geofencing Utilities
 */

export interface TelemetryPoint {
  lat: number;
  lng: number;
  speedKmh: number;
  heading: number;
  accuracyMeters?: number;
  batteryLevel?: number;
  timestamp: string;
}

export interface ActiveTripSession {
  id: string;
  schoolId: string;
  vehicleId?: string;
  vehicleReg?: string;
  vehicleModel?: string;
  routeId?: string;
  routeName?: string;
  escortId?: string;
  escortName?: string;
  escortPhone?: string;
  tripType: 'morning_pickup' | 'afternoon_dropoff' | 'shared_ride' | 'special_event';
  status: 'scheduled' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
  currentLat?: number;
  currentLng?: number;
  currentSpeedKmh: number;
  currentHeading: number;
  currentStopIndex: number;
  totalStops: number;
  batteryLevel?: number;
  gpsAccuracyMeters?: number;
  startedAt: string;
  lastPingAt: string;
  completedAt?: string;
}

export interface RouteStopPoint {
  id: string;
  stopNumber: number;
  name: string;
  landmark?: string;
  lat: number;
  lng: number;
  etaMorning?: string;
  etaAfternoon?: string;
  status: 'pending' | 'approaching' | 'arrived' | 'departed' | 'skipped';
  studentsCount: number;
  studentNames?: string[];
}

export interface GeofenceEvent {
  type: 'approaching_stop' | 'arrived_stop' | 'approaching_gate' | 'speeding_warning' | 'delay_warning';
  message: string;
  distanceMeters: number;
  etaMinutes: number;
  stopName?: string;
  timestamp: string;
}

/**
 * Calculates Great-Circle Distance (Haversine Formula) in Meters
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

/**
 * Calculates Compass Bearing in Degrees (0° to 360°)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return ((θ * 180) / Math.PI + 360) % 360; // in degrees
}

/**
 * Estimates remaining Travel Time in Minutes
 * Adds a traffic congestion factor for typical urban Nigerian rush hours.
 */
export function estimateEtaMinutes(
  distanceMeters: number,
  currentSpeedKmh: number,
  urbanTrafficBufferMultiplier: number = 1.25
): number {
  // If vehicle is stopped or moving under 10 km/h, assume urban average 20 km/h
  const effectiveSpeedKmh = currentSpeedKmh > 10 ? currentSpeedKmh : 20;
  const speedMetersPerMinute = (effectiveSpeedKmh * 1000) / 60;
  const rawMinutes = distanceMeters / speedMetersPerMinute;
  return Math.max(1, Math.round(rawMinutes * urbanTrafficBufferMultiplier));
}
