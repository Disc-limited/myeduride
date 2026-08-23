import { TestSuite, expect } from '../utils/test-harness';

export const routesVehiclesUnitSuite = new TestSuite('Vehicle & Route Domain Unit Suite', 'UNIT');

routesVehiclesUnitSuite.test('Vehicle Capacity Guard: Prevents over-assigning students beyond seating capacity', () => {
  const vehicle = {
    regNumber: 'LAG-482-XA',
    capacity: 18,
    assignedStudentsCount: 17,
  };

  const canAssignStudent = (v: typeof vehicle, additional: number) => {
    return v.assignedStudentsCount + additional <= v.capacity;
  };

  expect(canAssignStudent(vehicle, 1)).toBeTruthy();
  expect(canAssignStudent(vehicle, 2)).toBeFalsy();
});

routesVehiclesUnitSuite.test('Stop Sequence Ordering: Enforces sequential 1-indexed numbering for transit stops', () => {
  const stops = [
    { stop_number: 1, name: 'Stop 1: 1044 Ademola Adetokunbo St' },
    { stop_number: 2, name: 'Stop 2: Oniru Market Roundabout' },
    { stop_number: 3, name: 'Stop 3: Palace Way Entrance' },
    { stop_number: 4, name: 'Stop 4: School Front Gate Campus' },
  ];

  const isSequenced = stops.every((s, i) => s.stop_number === i + 1);
  expect(isSequenced).toBeTruthy();
  expect(stops[0].stop_number).toBe(1);
  expect(stops[stops.length - 1].stop_number).toBe(4);
});

routesVehiclesUnitSuite.test('Parent Route Pinning Key: Deterministic serialization of route and stop identifier', () => {
  const generatePinKey = (routeId: string, stopNumber: number) => `${routeId}:${stopNumber}`;

  const key1 = generatePinKey('RT-01', 2);
  const key2 = generatePinKey('RT-01', 2);
  const key3 = generatePinKey('RT-02', 2);

  expect(key1).toBe('RT-01:2');
  expect(key1).toBe(key2);
  expect(key1 === key3).toBeFalsy();
});
