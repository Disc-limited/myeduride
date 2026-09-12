import { TestSuite, expect } from '../utils/test-harness';

export const parentSchoolRouteDistanceSuite = new TestSuite(
  'City Manager Parent Pinned House to School Route & Distance Engine Suite',
  'UNIT'
);

// 1. Invariant 1: Haversine distance calculation between School Pin and Parent House Pin
parentSchoolRouteDistanceSuite.test('Invariant 1: Exact Haversine distance formula between school GPS and parent house GPS', () => {
  const computeHaversineDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  };

  // Case 1: Corona Secondary (Victoria Island, 6.4281, 3.4219) to Admiralty Way, Lekki (6.4474, 3.4731)
  const distance1 = computeHaversineDistanceKm(6.4281, 3.4219, 6.4474, 3.4731);
  expect(distance1).toBeGreaterThan(5.0);
  expect(distance1).toBeLessThan(7.0);

  // Case 2: Identical coordinates = 0.00 km
  const distanceZero = computeHaversineDistanceKm(6.45, 3.45, 6.45, 3.45);
  expect(distanceZero).toBe(0);

  // Case 3: Ikoyi to Victoria Island (~3.2 km)
  const distance3 = computeHaversineDistanceKm(6.4468, 3.4354, 6.4281, 3.4219);
  expect(distance3).toBeGreaterThan(2.0);
  expect(distance3).toBeLessThan(4.0);
});

// 2. Invariant 2: Estimated transit commute time
parentSchoolRouteDistanceSuite.test('Invariant 2: Transit time estimation factors urban transit speed with a sensible floor', () => {
  const estimateTransitTimeMins = (distanceKm: number, averageSpeedKmh: number = 25): number => {
    if (distanceKm <= 0) return 0;
    const rawMins = (distanceKm / averageSpeedKmh) * 60;
    return Math.max(5, Math.round(rawMins)); // 5 minute minimum buffer for boarding/unboarding
  };

  // 5 km commute @ 25 km/h = 12 mins
  expect(estimateTransitTimeMins(5)).toBe(12);

  // 10 km commute @ 25 km/h = 24 mins
  expect(estimateTransitTimeMins(10)).toBe(24);

  // 1 km commute @ 25 km/h = 2.4 mins -> min buffer 5 mins
  expect(estimateTransitTimeMins(1)).toBe(5);

  // 0 km = 0 mins
  expect(estimateTransitTimeMins(0)).toBe(0);
});

// 3. Invariant 3: Safe fallback coordinates handling for schools
parentSchoolRouteDistanceSuite.test('Invariant 3: Graceful fallback when school custom GPS coordinates are unconfigured', () => {
  const resolveSchoolGps = (school: {
    id: string;
    name: string;
    gps_lat?: number | null;
    gps_lng?: number | null;
  }) => {
    const DEFAULT_CITY_LAT = 6.4474;
    const DEFAULT_CITY_LNG = 3.4731;

    return {
      lat: school.gps_lat != null ? Number(school.gps_lat) : DEFAULT_CITY_LAT,
      lng: school.gps_lng != null ? Number(school.gps_lng) : DEFAULT_CITY_LNG,
      isCustomPinned: school.gps_lat != null && school.gps_lng != null,
    };
  };

  const configuredSchool = {
    id: 'SCH-001',
    name: 'Grange School Ikeja',
    gps_lat: 6.5921,
    gps_lng: 3.3541,
  };
  const resolvedConfigured = resolveSchoolGps(configuredSchool);
  expect(resolvedConfigured.lat).toBe(6.5921);
  expect(resolvedConfigured.lng).toBe(3.3541);
  expect(resolvedConfigured.isCustomPinned).toBe(true);

  const unconfiguredSchool = {
    id: 'SCH-002',
    name: 'Atlantic Hall Epe',
    gps_lat: null,
    gps_lng: null,
  };
  const resolvedUnconfigured = resolveSchoolGps(unconfiguredSchool);
  expect(resolvedUnconfigured.lat).toBe(6.4474);
  expect(resolvedUnconfigured.lng).toBe(3.4731);
  expect(resolvedUnconfigured.isCustomPinned).toBe(false);
});

// 4. Invariant 4: Turn-by-Turn driving directions link generation
parentSchoolRouteDistanceSuite.test('Invariant 4: Google Maps turn-by-turn driving URL includes valid origin and destination coordinates', () => {
  const buildDirectionsUrl = (schoolLat: number, schoolLng: number, houseLat: number, houseLng: number): string => {
    return `https://www.google.com/maps/dir/?api=1&origin=${schoolLat},${schoolLng}&destination=${houseLat},${houseLng}&travelmode=driving`;
  };

  const url = buildDirectionsUrl(6.4474, 3.4731, 6.4521, 3.4802);
  expect(url).toContain('https://www.google.com/maps/dir/');
  expect(url).toContain('origin=6.4474,3.4731');
  expect(url).toContain('destination=6.4521,3.4802');
  expect(url).toContain('travelmode=driving');
});

// 5. Invariant 5: Distance threshold filtering and sorting for City Manager dispatch
parentSchoolRouteDistanceSuite.test('Invariant 5: Filter and sort parent pinned students by distance corridor from school', () => {
  type PinnedStudent = {
    studentId: string;
    name: string;
    distanceKm: number;
  };

  const filterAndSortByDistance = (
    students: PinnedStudent[],
    maxDistanceKm?: number,
    sortAscending: boolean = true
  ) => {
    let result = [...students];
    if (typeof maxDistanceKm === 'number') {
      result = result.filter((s) => s.distanceKm <= maxDistanceKm);
    }
    result.sort((a, b) => sortAscending ? a.distanceKm - b.distanceKm : b.distanceKm - a.distanceKm);
    return result;
  };

  const dataset: PinnedStudent[] = [
    { studentId: 'S1', name: 'Amina', distanceKm: 8.5 },
    { studentId: 'S2', name: 'Emeka', distanceKm: 2.1 },
    { studentId: 'S3', name: 'Zainab', distanceKm: 4.6 },
    { studentId: 'S4', name: 'Tunde', distanceKm: 14.2 },
  ];

  // Within 5km
  const within5km = filterAndSortByDistance(dataset, 5.0, true);
  expect(within5km.length).toBe(2);
  expect(within5km[0].name).toBe('Emeka');
  expect(within5km[1].name).toBe('Zainab');

  // Sorted ascending all
  const sortedAll = filterAndSortByDistance(dataset, undefined, true);
  expect(sortedAll[0].distanceKm).toBe(2.1);
  expect(sortedAll[3].distanceKm).toBe(14.2);
});
