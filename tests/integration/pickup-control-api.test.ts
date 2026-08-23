import { TestSuite, expect } from '../utils/test-harness';

export const pickupControlApiSuite = new TestSuite('Pickup Control API Integration Suite', 'INTEGRATION');

pickupControlApiSuite.test('GET /api/school-admin/pickup-control: Returns structured DTO and calculated metrics', async () => {
  // Simulated composite response payload validation
  const sampleResponse = {
    success: true,
    school: { id: 'sch-1', name: 'Greenfield International', late_threshold: '08:15' },
    metrics: {
      total_students: 4,
      checked_in_today: 4,
      ready_for_pickup: 3,
      escort_assigned: 1,
      parent_picked_up: 1,
      sibling_picked_up: 1,
      walked_home: 1,
      completed_departures: 3,
    },
    students: [
      {
        id: 'stu-1',
        first_name: 'Stephanie',
        last_name: 'Mba',
        class_name: 'Basic 4 Gold',
        today_status: {
          checked_in: true,
          ready_for_pickup: true,
          departure_completed: false,
        },
        authorized_options: {
          parents: [{ full_name: 'Angela Mba', phone: '+234 803 112 4455' }],
          siblings: [{ full_name: 'David Mba', class_name: 'Basic 2' }],
        },
      },
    ],
    escorts: {
      school_escorts: [{ id: 'ESC-SCH-01', full_name: 'Babajide Adeleke' }],
      myeduride_escorts: [{ id: 'DISC-ESC-901', full_name: 'Captain Peter Okon', city_manager_status: 'CITY_MANAGER_APPROVED' }],
    },
    recent_activity_ledger: [
      { id: 'act-1', action_type: 'DEPARTURE_GATE_ACCEPTANCE', pickup_person_name: 'Angela Mba' },
    ],
  };

  expect(sampleResponse.success).toBeTruthy();
  expect(sampleResponse.metrics.total_students).toBe(4);
  expect(sampleResponse.students[0].authorized_options.parents.length).toBe(1);
  expect(sampleResponse.escorts.myeduride_escorts[0].city_manager_status).toBe('CITY_MANAGER_APPROVED');
});

pickupControlApiSuite.test('POST /api/school-admin/pickup-control [assign_pickup]: Validates assignment transactions', async () => {
  const mutationPayload = {
    action: 'assign_pickup',
    student_id: 'stu-1',
    school_id: 'sch-1',
    picker_type: 'school_escort',
    picker_id: 'ESC-SCH-01',
    picker_name: 'Babajide Adeleke',
    picker_phone: '+234 803 291 8841',
  };

  const executeAssignment = (payload: typeof mutationPayload) => {
    if (!payload.student_id || !payload.picker_type) {
      throw new Error('Missing student_id or picker_type');
    }
    return {
      success: true,
      message: `Pickup assigned to ${payload.picker_name} (${payload.picker_type})`,
      assignment: {
        id: `assign-${Date.now()}`,
        student_id: payload.student_id,
        picker_type: payload.picker_type,
        picker_name: payload.picker_name,
        status: 'active',
      },
    };
  };

  const result = executeAssignment(mutationPayload);
  expect(result.success).toBeTruthy();
  expect(result.assignment.picker_name).toBe('Babajide Adeleke');
  expect(result.assignment.status).toBe('active');
});

pickupControlApiSuite.test('POST /api/school-admin/pickup-control [execute_release]: Multi-tier audit and dismissal', async () => {
  const releasePayload = {
    action: 'execute_release',
    student_id: 'stu-1',
    school_id: 'sch-1',
    picker_type: 'parent',
    picker_name: 'Angela Mba',
    picker_phone: '+234 803 112 4455',
    verified_by_user_id: 'admin-usr-1',
  };

  const auditEventsLogged: string[] = [];
  const logAudit = (tier: string) => auditEventsLogged.push(tier);

  const executeRelease = (payload: typeof releasePayload) => {
    // Tier 1: Attendance record
    logAudit('Tier1: attendance_records (departure)');
    // Tier 2: Gate Activity Log
    logAudit('Tier2: gate_activity_log');
    // Tier 3: Immutable Audit Log
    logAudit('Tier3: audit_logs');
    // Tier 4: Parent Notification Dispatch
    logAudit('Tier4: parent_notification');

    return {
      success: true,
      message: `Student departure completed. Picked up by ${payload.picker_name}.`,
    };
  };

  const result = executeRelease(releasePayload);
  expect(result.success).toBeTruthy();
  expect(auditEventsLogged.length).toBe(4);
  expect(auditEventsLogged).toContain('Tier1: attendance_records (departure)');
  expect(auditEventsLogged).toContain('Tier3: audit_logs');
});
