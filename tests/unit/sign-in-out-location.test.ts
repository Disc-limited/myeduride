import { TestSuite, expect } from '../utils/test-harness';
import {
  resolveSchoolGateLocation,
  resolveRecordLocation,
  SchoolLocationSource,
  RecordLocationInput,
} from '@/lib/attendance/location-resolver';

export const signInOutLocationSuite = new TestSuite(
  'Accurate Sign-In / Sign-Out Location & Geofence Resolution Suite',
  'UNIT'
);

// 1. Authoritative School Gate Location Resolution with Full Coordinates & Landmark
signInOutLocationSuite.test('Invariant 1: Resolves full campus gate location with landmark and GPS coordinates', () => {
  const school: SchoolLocationSource = {
    id: 'SCH-001',
    name: 'Corona International Secondary School',
    location_address: 'Main Entrance Gate A, Victoria Island',
    location_landmark: 'Opposite Eko Hotel',
    gps_lat: 6.4281,
    gps_lng: 3.4219,
  };

  const resolved = resolveSchoolGateLocation(school);

  expect(resolved.location_name).toBe('Main Entrance Gate A, Victoria Island (near Opposite Eko Hotel)');
  expect(resolved.terminal_name).toBe('Main Entrance Gate A, Victoria Island');
  expect(resolved.landmark).toBe('Opposite Eko Hotel');
  expect(resolved.gps_lat).toBe(6.4281);
  expect(resolved.gps_lng).toBe(3.4219);
  expect(resolved.gps_coords).toBe('6.4281, 3.4219');
  expect(resolved.geofence_verified).toBe(true);
  expect(resolved.display_badge).toContain('Geofence Verified');
});

// 2. School Gate Location Fallback when Address or Coordinates are Missing
signInOutLocationSuite.test('Invariant 2: Gracefully falls back when school address or coordinates are missing', () => {
  const partialSchool: SchoolLocationSource = {
    id: 'SCH-002',
    name: 'Kings College',
    address: 'Catholic Mission Street, Lagos Island',
    gps_lat: null,
    gps_lng: null,
  };

  const resolved = resolveSchoolGateLocation(partialSchool);

  expect(resolved.location_name).toBe('Catholic Mission Street, Lagos Island');
  expect(resolved.gps_coords).toBe(null);
  expect(resolved.geofence_verified).toBe(false);

  // Null school test
  const nullResolved = resolveSchoolGateLocation(null);
  expect(nullResolved.location_name).toBe('Main Campus Gate');
  expect(nullResolved.geofence_verified).toBe(false);
});

// 3. Record-Specific Location Overrides Default School Location
signInOutLocationSuite.test('Invariant 3: Specific record location and coordinates override school defaults', () => {
  const schoolLocation = resolveSchoolGateLocation({
    name: 'Queens College',
    address: 'Yaba, Lagos',
    gps_lat: 6.5143,
    gps_lng: 3.3768,
  });

  const studentRecord: RecordLocationInput = {
    location_name: 'North Sports Complex Exit Gate',
    gps_lat: 6.5165,
    gps_lng: 3.3790,
    geofence_verified: true,
  };

  const resolved = resolveRecordLocation(studentRecord, schoolLocation, 'departure');

  expect(resolved.location_name).toBe('North Sports Complex Exit Gate');
  expect(resolved.gps_coords).toBe('6.5165, 3.3790');
  expect(resolved.geofence_verified).toBe(true);
  expect(resolved.action_label).toContain('Signed out at North Sports Complex Exit Gate');
  expect(resolved.action_label).toContain('(6.5165, 3.3790)');
  expect(resolved.action_label).toContain('Geofence Verified');
});

// 4. Record Gracefully Inherits School Location when Record Columns are Null
signInOutLocationSuite.test('Invariant 4: Record gracefully inherits school gate location when record columns are null', () => {
  const schoolLocation = resolveSchoolGateLocation({
    name: 'Grace High School',
    location_address: 'Gbagada Expressway Gate',
    gps_lat: 6.5500,
    gps_lng: 3.3850,
  });

  // Legacy or unpopulated record
  const legacyStaffRecord: RecordLocationInput = {
    location_name: null,
    gps_lat: null,
    gps_lng: null,
    geofence_verified: null,
  };

  const resolved = resolveRecordLocation(legacyStaffRecord, schoolLocation, 'clock_in');

  expect(resolved.location_name).toBe('Gbagada Expressway Gate');
  expect(resolved.gps_coords).toBe('6.5500, 3.3850');
  expect(resolved.geofence_verified).toBe(true);
  expect(resolved.action_label).toContain('Received at Gbagada Expressway Gate');
});

// 5. Action Type Prefix Invariants (Arrival vs Departure vs Clock-in vs Clock-out)
signInOutLocationSuite.test('Invariant 5: Action prefix accurately identifies arrival, departure, clock-in, and clock-out', () => {
  const schoolLocation = resolveSchoolGateLocation({
    name: 'Lekki British School',
    location_address: 'Admiralty Gate',
    gps_lat: 6.4474,
    gps_lng: 3.4731,
  });

  const arrival = resolveRecordLocation(null, schoolLocation, 'arrival');
  expect(arrival.action_label).toContain('Received at Admiralty Gate');

  const departure = resolveRecordLocation(null, schoolLocation, 'departure');
  expect(departure.action_label).toContain('Signed out at Admiralty Gate');

  const clockIn = resolveRecordLocation(null, schoolLocation, 'clock_in');
  expect(clockIn.action_label).toContain('Received at Admiralty Gate');

  const clockOut = resolveRecordLocation(null, schoolLocation, 'clock_out');
  expect(clockOut.action_label).toContain('Signed out at Admiralty Gate');
});

// 6. Resilient Parsing of String or Malformed GPS Coordinates
signInOutLocationSuite.test('Invariant 6: Handles stringified numbers and malformed coordinates gracefully', () => {
  const schoolLocation = resolveSchoolGateLocation({
    name: 'Atlantic Hall',
    gps_lat: '6.4520' as any,
    gps_lng: '3.4910' as any,
  });

  expect(schoolLocation.gps_lat).toBe(6.452);
  expect(schoolLocation.gps_lng).toBe(3.491);
  expect(schoolLocation.gps_coords).toBe('6.4520, 3.4910');
  expect(schoolLocation.geofence_verified).toBe(true);

  // Invalid strings
  const invalidSchool = resolveSchoolGateLocation({
    name: 'Unknown School',
    gps_lat: 'invalid-lat' as any,
    gps_lng: null,
  });
  expect(invalidSchool.gps_lat).toBe(null);
  expect(invalidSchool.gps_coords).toBe(null);
  expect(invalidSchool.geofence_verified).toBe(false);
});
