/**
 * Road Network Routing Service
 * 
 * Fetches real driving road network geometries (turn-by-turn curves along Lagos and
 * Nigerian city streets) using high-efficiency OSRM service with in-memory caching
 * and automatic fallback to Catmull-Rom spline interpolation if offline.
 */

export interface LatLngPoint {
  lat: number;
  lng: number;
}

// In-memory LRU cache for route requests to prevent duplicate network calls
const routeCache = new Map<string, { points: LatLngPoint[]; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getCacheKey(waypoints: LatLngPoint[]): string {
  return waypoints
    .map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`)
    .join(';');
}

/**
 * Calculates straight line distance in meters between two coordinates (Haversine formula).
 */
export function haversineDistanceMeters(p1: LatLngPoint, p2: LatLngPoint): number {
  const R = 6371e3;
  const phi1 = (p1.lat * Math.PI) / 180;
  const phi2 = (p2.lat * Math.PI) / 180;
  const deltaPhi = ((p2.lat - p1.lat) * Math.PI) / 180;
  const deltaLambda = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Generates smooth curved road corridor waypoints connecting sparse points
 * if routing service is offline or rate-limited.
 */
function generateCorridorSpline(waypoints: LatLngPoint[]): LatLngPoint[] {
  if (waypoints.length <= 1) return waypoints;
  if (waypoints.length === 2) {
    const p1 = waypoints[0];
    const p2 = waypoints[1];
    const steps = 16;
    const pts: LatLngPoint[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Slight gentle curve offset to simulate natural street alignment
      const curvature = Math.sin(t * Math.PI) * 0.0006;
      pts.push({
        lat: p1.lat + (p2.lat - p1.lat) * t + curvature * 0.7,
        lng: p1.lng + (p2.lng - p1.lng) * t + curvature * 0.4,
      });
    }
    return pts;
  }

  // Multi-point Catmull-Rom spline
  const result: LatLngPoint[] = [];
  const n = waypoints.length;

  for (let i = 0; i < n - 1; i++) {
    const p0 = waypoints[Math.max(0, i - 1)];
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const p3 = waypoints[Math.min(n - 1, i + 2)];

    const steps = 12;
    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      const t2 = t * t;
      const t3 = t2 * t;

      const lat =
        0.5 *
        (2 * p1.lat +
          (-p0.lat + p2.lat) * t +
          (2 * p0.lat - 5 * p1.lat + 4 * p2.lat - p3.lat) * t2 +
          (-p0.lat + 3 * p1.lat - 3 * p2.lat + p3.lat) * t3);

      const lng =
        0.5 *
        (2 * p1.lng +
          (-p0.lng + p2.lng) * t +
          (2 * p0.lng - 5 * p1.lng + 4 * p2.lng - p3.lng) * t2 +
          (-p0.lng + 3 * p1.lng - 3 * p2.lng + p3.lng) * t3);

      result.push({ lat, lng });
    }
  }

  result.push(waypoints[n - 1]);
  return result;
}

/**
 * Main public entry point: Fetches actual driving road geometry connecting given waypoints.
 * 
 * @param waypoints Ordered stops along the journey (e.g. [vehicleStart, studentHouse1, ..., schoolDestination])
 * @returns Dense array of { lat, lng } coordinates following actual road contours
 */
export async function fetchDrivingRoute(waypoints: LatLngPoint[]): Promise<LatLngPoint[]> {
  const validWaypoints = waypoints.filter(
    (w) => w && Number.isFinite(w.lat) && Number.isFinite(w.lng) && (w.lat !== 0 || w.lng !== 0)
  );

  if (validWaypoints.length < 2) {
    return validWaypoints;
  }

  // Limit to 20 coordinates to fit within URL parameters and avoid excessive routing complexity
  const sampled = validWaypoints.length > 20
    ? [
        validWaypoints[0],
        ...validWaypoints.slice(1, -1).filter((_, idx) => idx % Math.ceil(validWaypoints.length / 15) === 0),
        validWaypoints[validWaypoints.length - 1],
      ]
    : validWaypoints;

  const cacheKey = getCacheKey(sampled);
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.points;
  }

  try {
    // OSRM expects: /route/v1/driving/{lng1},{lat1};{lng2},{lat2};...
    const coordsParam = sampled.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson&continue_straight=true`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes[0]?.geometry?.coordinates) {
        const rawCoords: [number, number][] = data.routes[0].geometry.coordinates;
        // OSRM returns [lng, lat] GeoJSON pairs -> convert to { lat, lng }
        const points: LatLngPoint[] = rawCoords.map(([lng, lat]) => ({ lat, lng }));

        if (points.length >= 2) {
          routeCache.set(cacheKey, { points, timestamp: Date.now() });
          return points;
        }
      }
    }
  } catch (err) {
    // Non-blocking fallback to smooth road corridor spline
    console.warn('[road-router] OSRM query fallback to corridor spline:', err);
  }

  // High-quality spline fallback
  const fallback = generateCorridorSpline(sampled);
  routeCache.set(cacheKey, { points: fallback, timestamp: Date.now() });
  return fallback;
}
