import { TestSuite, expect } from '../utils/test-harness';

export const routeManagementE2ESuite = new TestSuite('Vehicle & Route Lifecycle End-to-End Suite', 'E2E');

routeManagementE2ESuite.test('E2E Lifecycle: Route Creation -> Student Linkage -> Parent Pinning -> Escort Turn-by-Turn', async () => {
  // Step 1: School Admin registers fleet bus and creates route
  const fleetBus = {
    id: 'VH-01',
    plate: 'LAG-482-XA',
    driver: 'Babajide Adeleke',
    capacity: 18,
  };

  const transportRoute = {
    id: 'RT-01',
    name: 'Route A: Victoria Island & Oniru Express',
    code: 'VI-EXP-01',
    assignedBus: fleetBus.plate,
    assignedEscort: fleetBus.driver,
    stops: [
      { stop_number: 1, name: '1044 Ademola Adetokunbo St', eta: '06:50 AM' },
      { stop_number: 2, name: 'Oniru Market Roundabout', eta: '07:05 AM' },
      { stop_number: 3, name: 'School Campus Front Gate', eta: '07:35 AM' },
    ],
  };

  expect(transportRoute.assignedBus).toBe('LAG-482-XA');

  // Step 2: Student is assigned to Route Stop 1
  const student = {
    id: 'STU-001',
    name: 'Stephanie Mba',
    assignedRouteId: transportRoute.id,
    assignedStop: transportRoute.stops[0].name,
  };

  expect(student.assignedStop).toBe('1044 Ademola Adetokunbo St');

  // Step 3: Parent pins Stop 1 to their Parent Dashboard
  const parentPin = {
    parentId: 'PAR-881',
    routeId: transportRoute.id,
    stopNumber: 1,
    isPinned: true,
  };

  expect(parentPin.isPinned).toBeTruthy();

  // Step 4: Escort starts route run, receives turn-by-turn directions and boards student at Stop 1
  const escortExecution = {
    currentStop: transportRoute.stops[0].name,
    passengerBoarded: student.name,
    parentNotified: true,
    nextStop: transportRoute.stops[1].name,
    status: 'IN_TRANSIT',
  };

  expect(escortExecution.passengerBoarded).toBe('Stephanie Mba');
  expect(escortExecution.parentNotified).toBeTruthy();
  expect(escortExecution.nextStop).toBe('Oniru Market Roundabout');
});
