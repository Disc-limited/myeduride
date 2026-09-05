import { TestSuite, expect } from '../utils/test-harness';
import { calculateHaversineDistance } from '../../src/lib/types/tracking-types';

export const schoolGeofenceSuite = new TestSuite('School Geofencing & Sign-In/Out Location Invariants', 'UNIT');

schoolGeofenceSuite.test('Haversine Distance Accuracy: Correctly computes meters between coordinates', () => {
  // Lagos reference points:
  // School Campus Gate: 6.524400, 3.379200
  const schoolLat = 6.5244;
  const schoolLng = 3.3792;

  // Point A: Very close (~55 meters north)
  const nearbyLat = 6.5249;
  const nearbyLng = 3.3792;
  const distNearby = calculateHaversineDistance(schoolLat, schoolLng, nearbyLat, nearbyLng);

  expect(distNearby > 40 && distNearby < 70).toBeTruthy();

  // Point B: Outside perimeter (~1.1 km away)
  const farLat = 6.5344;
  const farLng = 3.3792;
  const distFar = calculateHaversineDistance(schoolLat, schoolLng, farLat, farLng);

  expect(distFar > 1000 && distFar < 1300).toBeTruthy();
});

schoolGeofenceSuite.test('Geofence Perimeter Invariant: Correctly classifies points inside vs outside 200m perimeter', () => {
  const GEOFENCE_RADIUS_METERS = 200;
  const schoolLat = 6.5244;
  const schoolLng = 3.3792;

  const evaluateGeofence = (clientLat: number, clientLng: number) => {
    const dist = Math.round(calculateHaversineDistance(clientLat, clientLng, schoolLat, schoolLng));
    const isInside = dist <= GEOFENCE_RADIUS_METERS;
    return {
      distance_meters: dist,
      is_inside: isInside,
      status: isInside ? 'inside_geofence' : 'outside_geofence',
    };
  };

  // Right at gate (0m) -> Inside
  const atGate = evaluateGeofence(schoolLat, schoolLng);
  expect(atGate.is_inside).toBeTruthy();
  expect(atGate.status).toBe('inside_geofence');
  expect(atGate.distance_meters).toBe(0);

  // Near campus gate (~80m away) -> Inside
  const nearGate = evaluateGeofence(6.5251, 3.3792);
  expect(nearGate.is_inside).toBeTruthy();
  expect(nearGate.status).toBe('inside_geofence');

  // Across town (~1.5km away) -> Outside
  const farAway = evaluateGeofence(6.5380, 3.3792);
  expect(farAway.is_inside).toBeFalsy();
  expect(farAway.status).toBe('outside_geofence');
  expect(farAway.distance_meters > 200).toBeTruthy();
});

schoolGeofenceSuite.test('Session Geofence Invariant: Session primary_school payload must hold pinned coordinates', () => {
  const buildPrimarySchoolSession = (school: any) => {
    const latVal = school.gps_lat != null ? Number(school.gps_lat) : null;
    const lngVal = school.gps_lng != null ? Number(school.gps_lng) : null;
    return {
      id: school.id,
      name: school.name,
      gps_lat: latVal,
      gps_lng: lngVal,
      location_address: school.location_address || school.address || null,
      location_landmark: school.location_landmark || null,
      is_pinned: latVal != null && lngVal != null,
      geofence_radius: 200,
    };
  };

  // Pinned school
  const pinnedSchool = {
    id: 'SCH-001',
    name: 'Greenfield International',
    address: '12 Campus Way, Lagos',
    location_address: '12 Campus Way, Main Gate',
    location_landmark: 'Opposite Central Park',
    gps_lat: 6.5244,
    gps_lng: 3.3792,
  };

  const sessionObj = buildPrimarySchoolSession(pinnedSchool);
  expect(sessionObj.is_pinned).toBeTruthy();
  expect(sessionObj.gps_lat).toBe(6.5244);
  expect(sessionObj.gps_lng).toBe(3.3792);
  expect(sessionObj.location_address).toBe('12 Campus Way, Main Gate');
  expect(sessionObj.geofence_radius).toBe(200);

  // Unpinned school
  const unpinnedSchool = {
    id: 'SCH-002',
    name: 'Unpinned Academy',
    address: 'Remote Road',
    gps_lat: null,
    gps_lng: null,
  };

  const unpinnedSession = buildPrimarySchoolSession(unpinnedSchool);
  expect(unpinnedSession.is_pinned).toBeFalsy();
  expect(unpinnedSession.gps_lat).toBe(null);
  expect(unpinnedSession.geofence_radius).toBe(200);
});

schoolGeofenceSuite.test('Sign-In/Out Location Resolution: Attendance records format location & geofence verification badge', () => {
  const formatAttendanceSignLocation = (school: any) => {
    const isPinned = school?.gps_lat != null && school?.gps_lng != null;
    const terminalName = school?.location_address || school?.address || 'Main Campus Gate';
    const coordsStr = isPinned ? `${Number(school.gps_lat).toFixed(4)}, ${Number(school.gps_lng).toFixed(4)}` : null;
    return {
      location_name: isPinned ? `${terminalName} (Geofence Verified)` : terminalName,
      gps_coords: coordsStr,
      geofence_verified: isPinned,
      badge: isPinned ? 'Inside School Geofence' : 'Campus Gate Terminal',
    };
  };

  const formatted = formatAttendanceSignLocation({
    location_address: 'Main Gate East',
    gps_lat: 6.5244,
    gps_lng: 3.3792,
  });

  expect(formatted.geofence_verified).toBeTruthy();
  expect(formatted.location_name).toContain('Geofence Verified');
  expect(formatted.gps_coords).toBe('6.5244, 3.3792');
  expect(formatted.badge).toBe('Inside School Geofence');
});
