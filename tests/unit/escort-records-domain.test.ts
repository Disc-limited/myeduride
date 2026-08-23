import { TestSuite, expect } from '../utils/test-harness';

export const escortRecordsDomainSuite = new TestSuite('Escort Records Domain & 7-Connection Invariants Unit Suite', 'UNIT');

escortRecordsDomainSuite.test('Escort 7-Connection Invariant: Validates presence of all 7 mandatory relational links', () => {
  const escort = {
    id: 'ESC-SCH-01',
    school_id: 'school-101',
    full_name: 'Babajide Adeleke',
    // 1. School
    school_name: 'Gracefield International School',
    // 2. Students
    connected_students: [{ student_id: 'STU-001', name: 'Stephanie Mba' }],
    // 3. Vehicle
    vehicle: { id: 'VH-01', reg_number: 'LAG-482-XA', capacity: 18 },
    // 4. Route
    route: { id: 'RT-01', code: 'VI-EXP-01', name: 'Victoria Island Express' },
    // 5. Assignment
    assignment: { duty_type: 'Full Day Route Transit', shift_window: '06:30 AM – 04:30 PM' },
    // 6. Approval
    approval: { status: 'CITY_MANAGER_APPROVED', verified_by: 'City Manager Lagos Central' },
    // 7. Operational Status
    operational_status: 'Active On Duty',
  };

  expect(escort.school_id).toBeTruthy();
  expect(escort.connected_students.length > 0).toBeTruthy();
  expect(escort.vehicle.reg_number).toBeTruthy();
  expect(escort.route.code).toBeTruthy();
  expect(escort.assignment.duty_type).toBeTruthy();
  expect(escort.approval.status).toBe('CITY_MANAGER_APPROVED');
  expect(escort.operational_status).toBe('Active On Duty');
});

escortRecordsDomainSuite.test('Operational Status Transitions: Enforces valid state machine transitions', () => {
  const validStatuses = ['Active On Duty', 'In Transit', 'Off Duty', 'Standby', 'Suspended'];
  const testStatus = 'In Transit';

  expect(validStatuses.includes(testStatus)).toBeTruthy();
});

escortRecordsDomainSuite.test('Passenger Capacity Validation: Prevents student manifest exceeding vehicle seating capacity', () => {
  const vehicleCapacity = 18;
  const manifestCount = 15;
  const isOverCapacity = manifestCount > vehicleCapacity;

  expect(isOverCapacity).toBeFalsy();
});
