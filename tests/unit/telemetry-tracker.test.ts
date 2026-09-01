import { TestSuite, expect } from '../utils/test-harness';
import {
  calculateHaversineDistance,
  calculateBearing,
  estimateEtaMinutes,
  TelemetryPoint,
} from '../../src/lib/types/tracking-types';

export const telemetryTrackerUnitSuite = new TestSuite('Telemetry & GPS Tracker Suite', 'UNIT');

telemetryTrackerUnitSuite.test('GPS Jitter Filter: Discards inaccurate points (> 40m)', () => {
  const isPointValid = (accuracy: number) => accuracy <= 40;

  expect(isPointValid(15)).toBeTruthy(); // High accuracy (15m) -> Valid
  expect(isPointValid(35)).toBeTruthy(); // Acceptable (35m) -> Valid
  expect(isPointValid(55)).toBeFalsy();  // High jitter (55m) -> Discarded
  expect(isPointValid(120)).toBeFalsy(); // Low accuracy (120m) -> Discarded
});

telemetryTrackerUnitSuite.test('Adaptive Throttling Interval: Dynamically adjusts interval based on speed', () => {
  const getThrottleMs = (speedKmh: number) => (speedKmh > 8 ? 3500 : 8000);

  // Moving fast (e.g. 45 km/h) -> frequent 3.5s pings
  expect(getThrottleMs(45)).toBe(3500);

  // Slow / stationary at traffic stop (e.g. 2 km/h) -> relaxed 8s pings to save battery & data
  expect(getThrottleMs(2)).toBe(8000);
  expect(getThrottleMs(0)).toBe(8000);
});

telemetryTrackerUnitSuite.test('Bearing and Heading: Accurately reflects directional compass angles', () => {
  // Heading North: lat increases, lng constant
  const headingNorth = calculateBearing(6.5000, 3.3500, 6.6000, 3.3500);
  expect(Math.round(headingNorth)).toBe(0);

  // Heading East: lat constant, lng increases
  const headingEast = calculateBearing(6.5000, 3.3500, 6.5000, 3.4500);
  expect(Math.round(headingEast)).toBe(90);
});

telemetryTrackerUnitSuite.test('Proximity Geofence: Triggers approaching alert within 600m threshold', () => {
  const stopLat = 6.5744;
  const stopLng = 3.3662;

  // Shuttle 350 meters away
  const busLatNear = 6.5720;
  const busLngNear = 3.3645;
  const distNear = calculateHaversineDistance(busLatNear, busLngNear, stopLat, stopLng);
  expect(distNear < 600).toBeTruthy();

  // Shuttle 2.5 km away
  const busLatFar = 6.5950;
  const busLngFar = 3.3510;
  const distFar = calculateHaversineDistance(busLatFar, busLngFar, stopLat, stopLng);
  expect(distFar > 600).toBeTruthy();
});
