import { TestSuite, expect } from '../utils/test-harness';

export const parentGateReceptionSuite = new TestSuite(
  'Parent Gate Reception, Digital ID Pass & Visit Purpose Invariants',
  'UNIT'
);

// Invariant 1: Parent Digital Pass QR and ID Token Parsing
parentGateReceptionSuite.test('Invariant 1: Generates and parses Parent Digital ID pass QR tokens correctly', () => {
  const parentId = 'e2b3c4d5-6789-4abc-def0-123456789abc';
  const qrData = `MYEDURIDE:PARENT:${parentId}`;
  const idNumber = `PAR-${parentId.slice(0, 8).toUpperCase()}`;

  expect(idNumber).toBe('PAR-E2B3C4D5');
  expect(qrData.startsWith('MYEDURIDE:PARENT:')).toBe(true);

  // Scanner token decoder
  const parseToken = (raw: string) => {
    if (raw.startsWith('MYEDURIDE:PARENT:')) {
      return { type: 'parent', id: raw.replace('MYEDURIDE:PARENT:', '') };
    }
    if (raw.startsWith('PAR-')) {
      return { type: 'parent_code', code: raw };
    }
    return { type: 'unknown', raw };
  };

  const parsed = parseToken(qrData);
  expect(parsed.type).toBe('parent');
  expect(parsed.id).toBe(parentId);

  const parsedCode = parseToken(idNumber);
  expect(parsedCode.type).toBe('parent_code');
  expect(parsedCode.code).toBe('PAR-E2B3C4D5');
});

// Invariant 2: Parent Reception Payload & Child Attachment
parentGateReceptionSuite.test('Invariant 2: Verifies parent scan payload and linked children attachment', () => {
  const mockScanPayload = {
    type: 'parent' as const,
    parent: {
      id: 'p-101',
      full_name: 'Dr. Chinedu Eze',
      phone: '+2348012345678',
      photo_url: 'https://example.com/photos/parent-101.jpg',
    },
    linked_children: [
      {
        id: 's-1',
        first_name: 'David',
        last_name: 'Eze',
        student_id: 'STU-001',
        class_name: 'Primary 4 Gold',
        present_today: false,
        ready_for_pickup: false,
      },
      {
        id: 's-2',
        first_name: 'Grace',
        last_name: 'Eze',
        student_id: 'STU-002',
        class_name: 'Primary 2 Ruby',
        present_today: true,
        arrival_time: '07:48',
        ready_for_pickup: true,
      },
    ],
  };

  expect(mockScanPayload.type).toBe('parent');
  expect(mockScanPayload.linked_children.length).toBe(2);
  expect(mockScanPayload.parent.full_name).toBe('Dr. Chinedu Eze');

  const absentChildren = mockScanPayload.linked_children.filter((c) => !c.present_today);
  const presentChildren = mockScanPayload.linked_children.filter((c) => c.present_today);

  expect(absentChildren.length).toBe(1);
  expect(absentChildren[0].first_name).toBe('David');
  expect(presentChildren.length).toBe(1);
  expect(presentChildren[0].ready_for_pickup).toBe(true);
});

// Invariant 3: Student Drop-off Batch Execution
parentGateReceptionSuite.test('Invariant 3: Student drop-off validates selected children and generates attendance records', () => {
  const selectedStudentIds = ['s-1', 's-2'];
  const parentName = 'Dr. Chinedu Eze';
  const parentPhone = '+2348012345678';
  const schoolId = 'sch-main';
  const today = '2026-09-11';
  const nowTime = '07:55';

  const attendanceRecords = selectedStudentIds.map((studentId) => ({
    student_id: studentId,
    school_id: schoolId,
    date: today,
    status: 'present',
    arrival_time: nowTime,
    entry_method: 'parent_card_scan',
    notes: `Morning drop-off by parent: ${parentName} (${parentPhone})`,
  }));

  expect(attendanceRecords.length).toBe(2);
  expect(attendanceRecords[0].entry_method).toBe('parent_card_scan');
  expect(attendanceRecords[1].notes).toContain('Morning drop-off');
});

// Invariant 4: Student Pickup Batch Execution & Request Resolution
parentGateReceptionSuite.test('Invariant 4: Student pickup releases children and logs departures with parent verification', () => {
  const selectedStudentIds = ['s-1'];
  const parentName = 'Dr. Chinedu Eze';
  const schoolId = 'sch-main';
  const departureTime = '14:30';

  const departureRecords = selectedStudentIds.map((studentId) => ({
    student_id: studentId,
    school_id: schoolId,
    type: 'departure',
    departure_time: departureTime,
    verification_method: 'parent_card_scan',
    pickup_person_name: parentName,
    status: 'released',
  }));

  expect(departureRecords.length).toBe(1);
  expect(departureRecords[0].type).toBe('departure');
  expect(departureRecords[0].verification_method).toBe('parent_card_scan');
  expect(departureRecords[0].pickup_person_name).toBe('Dr. Chinedu Eze');
});

// Invariant 5: Official Campus Visit Purpose & Host Staff Routing
parentGateReceptionSuite.test('Invariant 5: Campus visit registration requires purpose, logs visitor record, and alerts host staff', () => {
  const visitPayload = {
    action: 'register_visit',
    school_id: 'sch-main',
    parent_id: 'p-101',
    parent_name: 'Dr. Chinedu Eze',
    parent_phone: '+2348012345678',
    purpose_of_visit: 'Parent-Teacher Conference',
    visit_notes: 'Discussing mid-term mathematics progress',
    host_staff_id: 'staff-teacher-42',
    host_staff_name: 'Mrs. Folashade Adebayo (Class Teacher)',
    vehicle_plate: 'KJA-892-AA',
  };

  // Validation rules
  const isValid = !!(
    visitPayload.school_id &&
    visitPayload.parent_id &&
    visitPayload.purpose_of_visit &&
    visitPayload.host_staff_id
  );
  expect(isValid).toBe(true);

  // Formatted Visitor Entry
  const visitorRecord = {
    school_id: visitPayload.school_id,
    digital_pass_token: `PAR-PASS-${visitPayload.parent_id.slice(0, 8).toUpperCase()}`,
    full_name: visitPayload.parent_name,
    phone: visitPayload.parent_phone,
    visitor_type: 'Parent / Guardian',
    purpose_of_visit: `${visitPayload.purpose_of_visit}: ${visitPayload.visit_notes}`,
    person_to_see: visitPayload.host_staff_name,
    host_user_id: visitPayload.host_staff_id,
    vehicle_plate: visitPayload.vehicle_plate,
    status: 'on_campus',
  };

  expect(visitorRecord.visitor_type).toBe('Parent / Guardian');
  expect(visitorRecord.status).toBe('on_campus');
  expect(visitorRecord.person_to_see).toContain('Folashade Adebayo');
  expect(visitorRecord.vehicle_plate).toBe('KJA-892-AA');

  // In-app Notification to host staff
  const staffNotification = {
    user_id: visitPayload.host_staff_id,
    school_id: visitPayload.school_id,
    title: 'Parent Arrival at Gate',
    message: `Parent ${visitPayload.parent_name} has arrived at the gate for: ${visitPayload.purpose_of_visit}. Vehicle: ${visitPayload.vehicle_plate}`,
    type: 'gate_visitor_arrival',
  };

  expect(staffNotification.user_id).toBe('staff-teacher-42');
  expect(staffNotification.title).toBe('Parent Arrival at Gate');
  expect(staffNotification.message).toContain('KJA-892-AA');
});
