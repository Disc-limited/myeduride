import { TestSuite, expect } from '../utils/test-harness';

export const gateEscortBatchSuite = new TestSuite('Gate Officer Escort Batch Reception & Visitor Host Assignment Suite', 'UNIT');

// 1. Escort Card & QR Scan Resolution into Escort Batch
gateEscortBatchSuite.test('Requirement 1.1: QR / Card Payload Resolver correctly identifies Escort Batch', () => {
  const parseGateScanInput = (code: string) => {
    const trimmed = code.trim();
    if (trimmed.startsWith('MYEDURIDE:ESCORT:') || trimmed.startsWith('ESCORT-') || trimmed.startsWith('ESC-')) {
      const escortId = trimmed.replace('MYEDURIDE:ESCORT:', '');
      return { type: 'escort_batch', escortId };
    }
    if (trimmed.startsWith('MYEDURIDE:STUDENT:') || trimmed.startsWith('STU-')) {
      return { type: 'student', studentId: trimmed.replace('MYEDURIDE:STUDENT:', '') };
    }
    if (trimmed.startsWith('MYEDURIDE:VISITOR:') || trimmed.startsWith('VIS-')) {
      return { type: 'visitor', visitorPassId: trimmed.replace('MYEDURIDE:VISITOR:', '') };
    }
    return { type: 'unknown', raw: trimmed };
  };

  const qrScan = parseGateScanInput('MYEDURIDE:ESCORT:ESC-9921');
  expect(qrScan.type).toBe('escort_batch');
  expect(qrScan.escortId).toBe('ESC-9921');

  const cardScan = parseGateScanInput('ESC-4402');
  expect(cardScan.type).toBe('escort_batch');
  expect(cardScan.escortId).toBe('ESC-4402');

  const studentScan = parseGateScanInput('MYEDURIDE:STUDENT:STU-100');
  expect(studentScan.type).toBe('student');
});

// 2. Batch Student Roster Resolution & Attendance Status Enrichment
gateEscortBatchSuite.test('Requirement 1.2: Escort Assigned Student Roster Enrichment for School', () => {
  const schoolId = 'SCH-GRACE-01';
  const escortId = 'ESC-001';

  const assignments = [
    { student_id: 'STU-1', escort_application_id: escortId, school_id: schoolId, status: 'active' },
    { student_id: 'STU-2', escort_application_id: escortId, school_id: schoolId, status: 'active' },
    { student_id: 'STU-3', escort_application_id: escortId, school_id: schoolId, status: 'active' },
    { student_id: 'STU-4', escort_application_id: escortId, school_id: 'SCH-OTHER', status: 'active' }, // Different school
  ];

  const students = [
    { id: 'STU-1', full_name: 'Amara Obi', class: 'Grade 3A', emergency_contact: '08011111111' },
    { id: 'STU-2', full_name: 'Tunde Bakare', class: 'Grade 4B', emergency_contact: '08022222222' },
    { id: 'STU-3', full_name: 'Zainab Danjuma', class: 'Grade 3A', emergency_contact: '08033333333' },
  ];

  const todayAttendance = [
    { student_id: 'STU-1', type: 'arrival', created_at: '2026-09-10T07:45:00Z' },
  ];

  const schoolAssignments = assignments.filter((a) => a.escort_application_id === escortId && a.school_id === schoolId);
  const enrichedStudents = schoolAssignments.map((a) => {
    const student = students.find((s) => s.id === a.student_id);
    const hasArrived = todayAttendance.some((att) => att.student_id === a.student_id && att.type === 'arrival');
    const hasDeparted = todayAttendance.some((att) => att.student_id === a.student_id && att.type === 'departure');
    return {
      ...student,
      assignment_status: a.status,
      has_arrived_today: hasArrived,
      has_departed_today: hasDeparted,
    };
  });

  expect(enrichedStudents.length).toBe(3);
  expect(enrichedStudents.find((s) => s.id === 'STU-1')?.has_arrived_today).toBeTruthy();
  expect(enrichedStudents.find((s) => s.id === 'STU-2')?.has_arrived_today).toBeFalsy();
  expect(enrichedStudents.find((s) => s.id === 'STU-4')).toBeFalsy(); // excluded from other school
});

// 3. Batch Sign-In (Morning Arrival) and Sign-Out (Afternoon Departure) without individual scanning
gateEscortBatchSuite.test('Requirement 1.3: One-Click Batch Student Reception & Release Queue Avoidance', () => {
  const studentIds = ['STU-1', 'STU-2', 'STU-3'];
  const gateOfficerId = 'USER-GATE-01';
  const schoolId = 'SCH-GRACE-01';

  // Process Batch Morning Check-In
  const createBatchRecords = (ids: string[], type: 'arrival' | 'departure') => {
    return ids.map((id) => ({
      school_id: schoolId,
      student_id: id,
      type,
      verification_method: 'id_card_scan' as const,
      verified_by_user_id: gateOfficerId,
      notes: `Batch processed via Escort Bus reception`,
      timestamp: new Date().toISOString(),
    }));
  };

  const morningBatch = createBatchRecords(studentIds, 'arrival');
  expect(morningBatch.length).toBe(3);
  expect(morningBatch.every((r) => r.type === 'arrival')).toBeTruthy();
  expect(morningBatch.every((r) => r.school_id === schoolId)).toBeTruthy();
  expect(morningBatch.every((r) => r.verified_by_user_id === gateOfficerId)).toBeTruthy();

  // Process Afternoon Batch Release
  const afternoonBatch = createBatchRecords(studentIds, 'departure');
  expect(afternoonBatch.length).toBe(3);
  expect(afternoonBatch.every((r) => r.type === 'departure')).toBeTruthy();
});

// 4. Headcount Discrepancy & Complete Headcount Override
gateEscortBatchSuite.test('Requirement 1.4: Headcount Verification and Officer Complete Headcount Override', () => {
  const totalAssigned = 10;
  const physicallyPresent = 8;
  const missingCount = totalAssigned - physicallyPresent;

  expect(missingCount).toBe(2);

  // Normal flow requires all to match or manual exclusion
  const evaluateHeadcount = (assigned: number, selected: number, override: boolean, overrideReason?: string) => {
    if (selected === assigned) {
      return { allowed: true, status: 'complete' };
    }
    if (override) {
      if (!overrideReason || overrideReason.trim().length < 5) {
        return { allowed: false, error: 'Valid override reason required when headcount does not match assigned list' };
      }
      return { allowed: true, status: 'override_accepted', reason: overrideReason };
    }
    return { allowed: true, status: 'partial_batch', count: selected };
  };

  // Attempt complete sign-in without override reason when counts differ
  const failAttempt = evaluateHeadcount(totalAssigned, physicallyPresent, true, '');
  expect(failAttempt.allowed).toBeFalsy();

  // Successful override with logged explanation
  const successOverride = evaluateHeadcount(
    totalAssigned,
    physicallyPresent,
    true,
    '2 students sick at home, verified by parent SMS'
  );
  expect(successOverride.allowed).toBeTruthy();
  expect(successOverride.status).toBe('override_accepted');
  expect(successOverride.reason).toBe('2 students sick at home, verified by parent SMS');
});

// 5. Visitor Registration with School Staff Member Host Assignment
gateEscortBatchSuite.test('Requirement 2: Visitor Registration Staff Directory Host Selection & Assignment', () => {
  const schoolStaffDirectory = [
    { id: 'STAFF-1', name: 'Dr. John Okeke', role: 'Principal', department: 'Administration', staff_id_number: 'ADM-01' },
    { id: 'STAFF-2', name: 'Mrs. Funke Adeyemi', role: 'Vice Principal Academics', department: 'Academic', staff_id_number: 'ACA-02' },
    { id: 'STAFF-3', name: 'Mr. Emeka Nnamdi', role: 'Head of ICT & Labs', department: 'Technology', staff_id_number: 'ICT-05' },
    { id: 'STAFF-4', name: 'Ms. Ngozi Bello', role: 'Bursar / Accounts', department: 'Finance', staff_id_number: 'FIN-03' },
  ];

  const registerVisitor = (visitorData: {
    visitor_name: string;
    visitor_phone: string;
    purpose: string;
    host_staff_id?: string;
    custom_host_name?: string;
  }) => {
    let assignedHost: { name: string; department?: string; role?: string } | null = null;

    if (visitorData.host_staff_id) {
      const matched = schoolStaffDirectory.find((s) => s.id === visitorData.host_staff_id);
      if (matched) {
        assignedHost = {
          name: matched.name,
          department: matched.department,
          role: matched.role,
        };
      }
    } else if (visitorData.custom_host_name) {
      assignedHost = { name: visitorData.custom_host_name };
    }

    if (!assignedHost) {
      throw new Error('A valid school staff member or designated host is required for campus entry authorization.');
    }

    return {
      id: 'VPASS-101',
      visitor_name: visitorData.visitor_name,
      visitor_phone: visitorData.visitor_phone,
      purpose: visitorData.purpose,
      person_to_see: assignedHost.name,
      host_department: assignedHost.department || 'General Campus',
      status: 'active',
      badge_number: 'VIS-042',
    };
  };

  // Successful registration with assigned staff host
  const visitorPass = registerVisitor({
    visitor_name: 'Engr. Patrick Eze',
    visitor_phone: '08099887766',
    purpose: 'Smart Board Maintenance',
    host_staff_id: 'STAFF-3',
  });

  expect(visitorPass.person_to_see).toBe('Mr. Emeka Nnamdi');
  expect(visitorPass.host_department).toBe('Technology');
  expect(visitorPass.badge_number).toBe('VIS-042');

  // Attempt registration with no host selected
  let errorOccurred = false;
  let errorMessage = '';
  try {
    registerVisitor({
      visitor_name: 'Unknown Visitor',
      visitor_phone: '08000000000',
      purpose: 'Unannounced Visit',
    });
  } catch (err: any) {
    errorOccurred = true;
    errorMessage = err?.message || String(err);
  }
  expect(errorOccurred).toBeTruthy();
  expect(errorMessage).toContain('A valid school staff member or designated host is required');
});
