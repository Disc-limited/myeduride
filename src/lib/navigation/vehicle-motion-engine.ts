/**
 * Vehicle Motion & 60FPS Gliding Engine
 * 
 * Provides Uber/Bolt-grade smooth motion smoothing, polyline snapping,
 * tangent road bearing rotation, and dead reckoning for live vehicle tracking.
 */

import { LatLngPoint, haversineDistanceMeters } from './road-router';

export interface MotionPoint extends LatLngPoint {
  heading: number;
  speedKmh: number;
}

export interface SnappedPathPosition {
  point: LatLngPoint;
  distanceAlongMeters: number;
  segmentIndex: number;
  heading: number;
  distanceFromSegmentMeters: number;
}

/**
 * Calculates initial forward compass bearing in degrees (0°..360°) from p1 to p2.
 */
export function calculateRoadBearing(p1: LatLngPoint, p2: LatLngPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const dLng = toRad(p2.lng - p1.lng);
  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const brng = toDeg(Math.atan2(y, x));
  return Math.round((brng + 360) % 360);
}

/**
 * Smoothly interpolates an angle from current to target along the shortest angular arc.
 * Eliminates 360° flip spins when crossing North (0°/360°).
 */
export function lerpBearing(current: number, target: number, alpha: number): number {
  let diff = (target - current) % 360;
  if (diff < -180) diff += 360;
  if (diff > 180) diff -= 360;
  return (current + diff * alpha + 360) % 360;
}

/**
 * Linear interpolation between two coordinates.
 */
export function lerpLatLng(p1: LatLngPoint, p2: LatLngPoint, t: number): LatLngPoint {
  const clampedT = Math.max(0, Math.min(1, t));
  return {
    lat: p1.lat + (p2.lat - p1.lat) * clampedT,
    lng: p1.lng + (p2.lng - p1.lng) * clampedT,
  };
}

/**
 * Pre-computes cumulative distances along a polyline.
 * cumulative[i] = total distance in meters from vertex 0 to vertex i.
 */
export function computeCumulativeDistances(polyline: LatLngPoint[]): number[] {
  const cumulative = [0];
  let total = 0;
  for (let i = 1; i < polyline.length; i++) {
    total += haversineDistanceMeters(polyline[i - 1], polyline[i]);
    cumulative.push(total);
  }
  return cumulative;
}

/**
 * Projects a point onto a line segment [a, b]. Returns projection point and parametric t (0..1).
 */
function projectPointOnSegment(
  p: LatLngPoint,
  a: LatLngPoint,
  b: LatLngPoint
): { point: LatLngPoint; t: number } {
  // Work in approximate flat local coordinates in meters
  const midLat = (a.lat + b.lat) / 2;
  const metersPerLat = 111132;
  const metersPerLng = 111320 * Math.cos((midLat * Math.PI) / 180);

  const ax = 0;
  const ay = 0;
  const bx = (b.lng - a.lng) * metersPerLng;
  const by = (b.lat - a.lat) * metersPerLat;
  const px = (p.lng - a.lng) * metersPerLng;
  const py = (p.lat - a.lat) * metersPerLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return { point: a, t: 0 };
  }

  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
  return {
    point: lerpLatLng(a, b, t),
    t,
  };
}

/**
 * Snaps any coordinate to the closest point along the given road polyline.
 */
export function snapToPolyline(
  coord: LatLngPoint,
  polyline: LatLngPoint[],
  cumulativeDistances?: number[]
): SnappedPathPosition {
  if (polyline.length === 0) {
    return {
      point: coord,
      distanceAlongMeters: 0,
      segmentIndex: 0,
      heading: 0,
      distanceFromSegmentMeters: 0,
    };
  }

  if (polyline.length === 1) {
    return {
      point: polyline[0],
      distanceAlongMeters: 0,
      segmentIndex: 0,
      heading: 0,
      distanceFromSegmentMeters: haversineDistanceMeters(coord, polyline[0]),
    };
  }

  const cumulative = cumulativeDistances || computeCumulativeDistances(polyline);

  let bestPoint = polyline[0];
  let bestDist = Infinity;
  let bestSegment = 0;
  let bestDistanceAlong = 0;
  let bestHeading = calculateRoadBearing(polyline[0], polyline[1]);

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const { point, t } = projectPointOnSegment(coord, a, b);
    const d = haversineDistanceMeters(coord, point);

    if (d < bestDist) {
      bestDist = d;
      bestPoint = point;
      bestSegment = i;
      const segLength = (cumulative[i + 1] || 0) - (cumulative[i] || 0);
      bestDistanceAlong = (cumulative[i] || 0) + segLength * t;
      bestHeading = calculateRoadBearing(a, b);
    }
  }

  return {
    point: bestPoint,
    distanceAlongMeters: bestDistanceAlong,
    segmentIndex: bestSegment,
    heading: bestHeading,
    distanceFromSegmentMeters: bestDist,
  };
}

/**
 * Returns point and heading at a specific distance along the polyline.
 */
export function getPointAtDistance(
  polyline: LatLngPoint[],
  cumulativeDistances: number[],
  distanceMeters: number
): { point: LatLngPoint; heading: number; segmentIndex: number } {
  const totalLength = cumulativeDistances[cumulativeDistances.length - 1] || 0;
  const targetDist = Math.max(0, Math.min(totalLength, distanceMeters));

  if (polyline.length <= 1) {
    return { point: polyline[0] || { lat: 0, lng: 0 }, heading: 0, segmentIndex: 0 };
  }

  for (let i = 0; i < cumulativeDistances.length - 1; i++) {
    const dStart = cumulativeDistances[i];
    const dEnd = cumulativeDistances[i + 1];

    if (targetDist >= dStart && targetDist <= dEnd) {
      const segLen = dEnd - dStart;
      const t = segLen > 0 ? (targetDist - dStart) / segLen : 0;
      const a = polyline[i];
      const b = polyline[i + 1];
      return {
        point: lerpLatLng(a, b, t),
        heading: calculateRoadBearing(a, b),
        segmentIndex: i,
      };
    }
  }

  // End of path
  const lastIdx = polyline.length - 1;
  return {
    point: polyline[lastIdx],
    heading: calculateRoadBearing(polyline[Math.max(0, lastIdx - 1)], polyline[lastIdx]),
    segmentIndex: Math.max(0, lastIdx - 1),
  };
}

/**
 * 60FPS Vehicle Motion Interpolator
 * 
 * Smoothly glides a vehicle along a road polyline using requestAnimationFrame.
 * Absorbs GPS jitter, smoothly eases into new GPS target positions, and rotates
 * vehicle heading tangent to the road.
 */
export class VehicleMotionAnimator {
  private polyline: LatLngPoint[] = [];
  private cumulative: number[] = [];
  private totalLength = 0;

  private currentDistanceMeters = 0;
  private targetDistanceMeters = 0;
  private currentHeading = 0;
  private currentSpeedKmh = 0;
  private targetSpeedKmh = 0;

  private isRunning = false;
  private rafId: number | null = null;
  private lastFrameTime = 0;

  private onUpdate: (pos: MotionPoint, traveledRatio: number) => void;

  constructor(onUpdate: (pos: MotionPoint, traveledRatio: number) => void) {
    this.onUpdate = onUpdate;
  }

  public setRoute(polyline: LatLngPoint[], initialSnapCoord?: LatLngPoint) {
    this.polyline = polyline.filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (this.polyline.length < 2) {
      this.totalLength = 0;
      this.cumulative = [0];
      return;
    }

    this.cumulative = computeCumulativeDistances(this.polyline);
    this.totalLength = this.cumulative[this.cumulative.length - 1] || 0;

    if (initialSnapCoord) {
      const snapped = snapToPolyline(initialSnapCoord, this.polyline, this.cumulative);
      this.currentDistanceMeters = snapped.distanceAlongMeters;
      this.targetDistanceMeters = snapped.distanceAlongMeters;
      this.currentHeading = snapped.heading;
    }
  }

  public updateTargetPosition(coord: LatLngPoint, speedKmh = 0, explicitHeading?: number) {
    if (this.polyline.length < 2) {
      // Off-route fallback
      this.onUpdate(
        {
          lat: coord.lat,
          lng: coord.lng,
          heading: explicitHeading || 0,
          speedKmh,
        },
        0
      );
      return;
    }

    const snapped = snapToPolyline(coord, this.polyline, this.cumulative);

    // Prevent backwards jumps along the route unless it's a significant displacement (> 400m)
    if (snapped.distanceAlongMeters >= this.currentDistanceMeters || Math.abs(snapped.distanceAlongMeters - this.currentDistanceMeters) > 400) {
      this.targetDistanceMeters = snapped.distanceAlongMeters;
    }

    this.targetSpeedKmh = Math.max(0, speedKmh);
    if (!this.isRunning) {
      this.start();
    }
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.tick();
  }

  public stop() {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = () => {
    if (!this.isRunning) return;

    const now = performance.now();
    const dtSeconds = Math.min((now - this.lastFrameTime) / 1000, 0.1); // Max delta 100ms
    this.lastFrameTime = now;

    // 1. Smoothly glide current distance toward target distance
    const distDiff = this.targetDistanceMeters - this.currentDistanceMeters;

    if (Math.abs(distDiff) > 0.05) {
      // Easing speed: catch up over ~1.2 seconds, or move at speedKmh
      const catchupSpeedMps = distDiff / 1.2;
      const actualSpeedMps = (this.targetSpeedKmh * 1000) / 3600;
      const effectiveMps = Math.max(actualSpeedMps, Math.abs(catchupSpeedMps));

      const step = Math.sign(distDiff) * Math.min(Math.abs(distDiff), effectiveMps * dtSeconds);
      this.currentDistanceMeters += step;
    }

    // 2. Smooth speed transition
    this.currentSpeedKmh += (this.targetSpeedKmh - this.currentSpeedKmh) * 0.1;

    // 3. Compute position along polyline at current distance
    if (this.polyline.length >= 2) {
      const { point, heading: targetBearing } = getPointAtDistance(
        this.polyline,
        this.cumulative,
        this.currentDistanceMeters
      );

      this.currentHeading = lerpBearing(this.currentHeading, targetBearing, 0.12);

      const ratio = this.totalLength > 0 ? this.currentDistanceMeters / this.totalLength : 0;

      this.onUpdate(
        {
          lat: point.lat,
          lng: point.lng,
          heading: Math.round(this.currentHeading),
          speedKmh: Math.round(this.currentSpeedKmh * 10) / 10,
        },
        Math.min(1, Math.max(0, ratio))
      );
    }

    this.rafId = requestAnimationFrame(this.tick);
  };
}
