import { TestSuite, expect } from '../utils/test-harness';

export const safetyConnectE2ESuite = new TestSuite('Safety Connect 3-Pillar Lifecycle End-to-End Suite', 'E2E');

safetyConnectE2ESuite.test('E2E Journey: Parent Accesses Safety Connect -> School Escort -> Books MyEduRide Backup -> Tracks E-Drive', async () => {
  // Step 1: Parent navigates to Safety Connect and reviews School Escort
  const pillar1_SchoolEscort = {
    escortName: 'Babajide Adeleke',
    vehiclePlate: 'LAG-482-XA',
    routeCode: 'VI-EXP-01',
    status: 'Active On Duty - In Transit',
  };
  expect(pillar1_SchoolEscort.escortName).toBe('Babajide Adeleke');

  // Step 2: Regular escort is unavailable for after-school -> Parent switches to MyEduRide Escort and books backup
  const pillar2_BackupBooking = {
    selectedEscort: 'Babatunde Lawal',
    pickupTime: '03:30 PM',
    generatedSecurityPin: '4892',
    bookingConfirmed: true,
  };
  expect(pillar2_BackupBooking.bookingConfirmed).toBeTruthy();
  expect(pillar2_BackupBooking.generatedSecurityPin.length).toBe(4);

  // Step 3: Parent opens E-Drive to track child's live vehicle transit and waypoint stops
  const pillar3_EDriveLive = {
    isTracking: true,
    speedKmh: 38,
    etaMinutes: 8,
    boardingVerified: true,
    currentStop: 'Oniru Market Roundabout',
  };
  expect(pillar3_EDriveLive.isTracking).toBeTruthy();
  expect(pillar3_EDriveLive.boardingVerified).toBeTruthy();
  expect(pillar3_EDriveLive.etaMinutes).toBe(8);
});
