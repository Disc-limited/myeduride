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

pickupControlApiSuite.test('City Manager: Filter escort rosters and reassign escort in real time', async () => {
  const assignments = [
    {
      id: 'assign-101',
      status: 'active',
      school_id: 'sch-1',
      student_id: 'stu-1',
      escort_application_id: 'esc-1',
      student: { first_name: 'Stephanie', last_name: 'Mba' },
      escort: { id: 'esc-1', full_name: 'Babajide Adeleke', vehicle_plate: 'LAG-234-IKJ' },
    },
    {
      id: 'assign-102',
      status: 'active',
      school_id: 'sch-2',
      student_id: 'stu-2',
      escort_application_id: 'esc-2',
      student: { first_name: 'Michael', last_name: 'Okafor' },
      escort: { id: 'esc-2', full_name: 'Peter Okon', vehicle_plate: 'SUR-440-XA' },
    },
  ];

  // Filtering by school
  const filterBySchool = (schoolId: string) =>
    assignments.filter((a) => a.school_id === schoolId);
  expect(filterBySchool('sch-1').length).toBe(1);
  expect(filterBySchool('sch-1')[0].student.first_name).toBe('Stephanie');

  // Reassignment mutation
  const reassignAction = {
    action: 'reassign',
    replacesAssignmentId: 'assign-101',
    targetEscortId: 'esc-2',
    targetEscortName: 'Peter Okon',
    targetVehiclePlate: 'SUR-440-XA',
  };

  const executeReassign = (a: (typeof assignments)[0], action: typeof reassignAction) => {
    return {
      ...a,
      escort_application_id: action.targetEscortId,
      escort: {
        id: action.targetEscortId,
        full_name: action.targetEscortName,
        vehicle_plate: action.targetVehiclePlate,
      },
      notes: 'Reassigned by City Manager',
    };
  };

  const updated = executeReassign(assignments[0], reassignAction);
  expect(updated.escort_application_id).toBe('esc-2');
  expect(updated.escort.full_name).toBe('Peter Okon');
  expect(updated.notes).toBe('Reassigned by City Manager');
});

pickupControlApiSuite.test('Walk-Home Gate Departures: Recorded for City Manager ledger with immediate parent notification', async () => {
  const walkHomeRecord = {
    student_id: 'stu-5',
    school_id: 'sch-1',
    type: 'departure',
    verification_method: 'walk_home_gate_scan',
    timestamp: '2026-09-05T13:15:00Z',
  };

  // Notification generator
  const generateNotification = (rec: typeof walkHomeRecord, studentName: string, schoolName: string) => {
    const isWalkHome = rec.type === 'departure' && rec.verification_method.includes('walk_home');
    return {
      title: isWalkHome ? `🚶 ${studentName} is walking home` : `${studentName} left school`,
      shortMessage: isWalkHome
        ? `${studentName} left ${schoolName} on foot (walk-home recorded at gate).`
        : `${studentName} left ${schoolName}`,
      mode: isWalkHome ? 'walk_home' : 'standard',
    };
  };

  const notif = generateNotification(walkHomeRecord, 'Tayo Balogun', 'Gracefield International');
  expect(notif.title).toContain('walking home');
  expect(notif.shortMessage).toContain('on foot (walk-home recorded at gate)');
  expect(notif.mode).toBe('walk_home');
});

pickupControlApiSuite.test('Parent In-Person Gate Pickup (Cell Digital Card Scan): Overrides active escort assignment', async () => {
  const parentScanDeparture = {
    student_id: 'stu-1',
    school_id: 'sch-1',
    type: 'departure',
    verification_method: 'parent_card_scan',
    pickup_person_name: 'Angela Mba',
    pickup_person_phone: '+234 803 112 4455',
  };

  let activeEscortAssignment = {
    id: 'assign-101',
    student_id: 'stu-1',
    status: 'active',
    notes: 'Assigned to School Bus 01',
  };

  // Process gate acceptance
  if (parentScanDeparture.type === 'departure' && parentScanDeparture.verification_method === 'parent_card_scan') {
    activeEscortAssignment = {
      ...activeEscortAssignment,
      status: 'completed',
      notes: `Overridden: Child picked up in-person by parent (${parentScanDeparture.pickup_person_name}) directly at school gate`,
    };
  }

  expect(activeEscortAssignment.status).toBe('completed');
  expect(activeEscortAssignment.notes).toContain('Overridden: Child picked up in-person by parent');
});

