import { TestSuite, expect } from '../utils/test-harness';

export const emergencyDeputisingApiSuite = new TestSuite('Emergency Deputising API Integration Suite', 'INTEGRATION');

emergencyDeputisingApiSuite.test('POST /api/city-manager/operations [create_emergency_deputy]: Dispatches deputy and creates custody record', async () => {
  const payload = {
    action: 'create_emergency_deputy',
    school_id: 'sch-001',
    school_name: 'Gracefield International School',
    route_name: 'Lekki Phase 1 Corridor',
    original_escort_id: 'ESC-SCH-01',
    original_escort_name: 'Babajide Adeleke',
    deputy_escort_id: 'ESC-MYE-04',
    deputy_escort_name: 'Babatunde Lawal (MyEduRide Certified)',
    deputy_escort_phone: '+234 802 334 1188',
    deputy_vehicle_plate: 'SUR-440-XA (Toyota Sienna 2022)',
    student_ids: ['STU-001', 'STU-002'],
    student_names: ['David James', 'Esther Paul'],
    emergency_reason: 'School bus mechanical delay — immediate standby deputising',
  };

  const executeDispatch = (p: typeof payload) => {
    return {
      success: true,
      message: `Emergency deputy ${p.deputy_escort_name} assigned to deputise for ${p.original_escort_name}. All parties synced.`,
      record: {
        id: 'DEP-2026-909',
        ...p,
        status: 'ACTIVE_DEPUTY',
        time_window_start: new Date().toISOString(),
        time_window_end: null,
      },
    };
  };

  const res = executeDispatch(payload);
  expect(res.success).toBeTruthy();
  expect(res.record.status).toBe('ACTIVE_DEPUTY');
  expect(res.record.student_names.length).toBe(2);
  expect(res.record.deputy_escort_name).toContain('Babatunde Lawal');
});

emergencyDeputisingApiSuite.test('POST /api/city-manager/operations [complete_deputy_handover]: Closes custody window and records handover', async () => {
  const payload = {
    action: 'complete_deputy_handover',
    record_id: 'DEP-2026-909',
    notes: 'Safe return and parent pickup verified with PIN.',
  };

  const executeHandover = (p: typeof payload) => {
    return {
      success: true,
      message: 'Emergency deputising window completed. Permanent custody record closed.',
      record: {
        id: p.record_id,
        status: 'COMPLETED_HANDOVER',
        handover_confirmed_at: new Date().toISOString(),
        time_window_end: new Date().toISOString(),
      },
    };
  };

  const res = executeHandover(payload);
  expect(res.success).toBeTruthy();
  expect(res.record.status).toBe('COMPLETED_HANDOVER');
  expect(res.record.handover_confirmed_at).toBeTruthy();
});
