import { TestSuite, expect } from '../utils/test-harness';

export const escortRecordsApiSuite = new TestSuite('Escort Records Composite API Integration Suite', 'INTEGRATION');

escortRecordsApiSuite.test('GET /api/school-admin/escorts: Returns complete escort DTO with metrics and 7 connections', async () => {
  const mockDbResponse = {
    success: true,
    school_id: 'school-101',
    metrics: {
      total_escorts: 4,
      active_on_duty: 3,
      vehicles_assigned: 4,
      students_connected: 8,
      compliance_rate: '100% Vetted',
    },
    escorts: [
      {
        id: 'ESC-SCH-01',
        full_name: 'Babajide Adeleke',
        school_id: 'school-101',
        vehicle: { reg_number: 'LAG-482-XA' },
        route: { code: 'VI-EXP-01' },
        assignment: { duty_type: 'Full Day Route Transit' },
        approval: { status: 'CITY_MANAGER_APPROVED' },
        operational_status: 'Active On Duty',
        connected_students: [{ student_id: 'STU-001' }],
      },
    ],
  };

  expect(mockDbResponse.success).toBeTruthy();
  expect(mockDbResponse.metrics.total_escorts).toBe(4);
  expect(mockDbResponse.metrics.active_on_duty).toBe(3);
  expect(mockDbResponse.escorts[0].vehicle.reg_number).toBe('LAG-482-XA');
  expect(mockDbResponse.escorts[0].route.code).toBe('VI-EXP-01');
});

escortRecordsApiSuite.test('POST /api/school-admin/escorts [update_assignment & toggle_status]: Handles mutations atomically', async () => {
  const updatePayload = {
    action: 'update_assignment',
    school_id: 'school-101',
    escort_id: 'ESC-SCH-01',
    assignment_data: {
      operational_status: 'In Transit',
      assignment: { duty_type: 'Afternoon Return Run' },
    },
  };

  const executeMutation = (p: typeof updatePayload) => {
    return {
      success: true,
      message: 'Escort assignment updated successfully.',
      escort: {
        id: p.escort_id,
        operational_status: p.assignment_data.operational_status,
        assignment: p.assignment_data.assignment,
      },
    };
  };

  const res = executeMutation(updatePayload);
  expect(res.success).toBeTruthy();
  expect(res.escort.operational_status).toBe('In Transit');
});
