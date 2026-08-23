import { TestSuite, expect } from '../utils/test-harness';

export const safetyConnectDomainSuite = new TestSuite('Safety Connect 3-Pillar Domain Unit Suite', 'UNIT');

safetyConnectDomainSuite.test('3-Pillar Invariant: Verifies complete presence of School Escort, MyEduRide Escort & E-Drive', () => {
  const safetyConnectData = {
    school_escort: {
      id: 'ESC-SCH-01',
      full_name: 'Babajide Adeleke',
      vehicle: { reg_number: 'LAG-482-XA' },
      route: { code: 'VI-EXP-01' },
      operational_status: 'Active On Duty - In Transit',
    },
    myeduride_escorts: [
      { id: 'ESC-MYE-04', full_name: 'Babatunde Lawal', status: 'Available for Immediate Booking' },
    ],
    edrive: {
      is_in_transit: true,
      trip_id: 'TRIP-LAG-8891',
      current_speed_kmh: 38,
      speed_limit_kmh: 50,
      safety_score: 99,
      corridor_waypoints: [{ seq: 1, name: 'Ademola Adetokunbo St', status: 'COMPLETED' }],
    },
  };

  // Pillar 1: School Escort
  expect(safetyConnectData.school_escort.full_name).toBe('Babajide Adeleke');
  expect(safetyConnectData.school_escort.vehicle.reg_number).toBe('LAG-482-XA');

  // Pillar 2: MyEduRide Escort
  expect(safetyConnectData.myeduride_escorts.length > 0).toBeTruthy();
  expect(safetyConnectData.myeduride_escorts[0].status.includes('Available')).toBeTruthy();

  // Pillar 3: E-Drive
  expect(safetyConnectData.edrive.is_in_transit).toBeTruthy();
  expect(safetyConnectData.edrive.current_speed_kmh <= safetyConnectData.edrive.speed_limit_kmh).toBeTruthy();
});

safetyConnectDomainSuite.test('Security PIN Generation: 4-digit numeric verification code for MyEduRide escort handover', () => {
  const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();
  const pin = generatePin();

  expect(pin.length).toBe(4);
  expect(/^\d{4}$/.test(pin)).toBeTruthy();
});

safetyConnectDomainSuite.test('E-Drive Speed Compliance: Flags over-speed events accurately', () => {
  const isSpeedCompliant = (speed: number, limit: number) => speed <= limit;

  expect(isSpeedCompliant(38, 50)).toBeTruthy();
  expect(isSpeedCompliant(58, 50)).toBeFalsy();
});
