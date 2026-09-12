import { TestSuite, expect } from '../utils/test-harness';

export const cityManagerEscortApprovalSuite = new TestSuite(
  'City Manager Escort Quick Approval, School Assignment & Student Manifest Suite',
  'UNIT'
);

// 1. Invariant: Quick Approve and Assign Escort to School
cityManagerEscortApprovalSuite.test('Invariant 1: Quick approve and assign escort to target school updates status and school link', () => {
  type EscortApplication = {
    id: string;
    fullName: string;
    status: string;
    schoolId?: string | null;
    schoolName?: string | null;
    escortCategory: string;
    notes?: string | null;
  };

  const quickApproveAndAssignSchool = (
    app: EscortApplication,
    targetSchool: { id: string; name: string },
    notes?: string
  ) => {
    if (!targetSchool.id) {
      throw new Error('Destination school ID is required for quick assignment');
    }

    return {
      ...app,
      status: 'CITY_MANAGER_APPROVED',
      schoolId: targetSchool.id,
      schoolName: targetSchool.name,
      createdBySchoolId: targetSchool.id,
      createdBySchoolName: targetSchool.name,
      escortCategory: 'school_escort',
      notes: notes || `Quick approved & assigned to ${targetSchool.name} by City Manager`,
      updatedAt: new Date().toISOString(),
    };
  };

  const pendingEscort: EscortApplication = {
    id: 'ESC-APP-881',
    fullName: 'Babatunde Fashola',
    status: 'PENDING_CITY_MANAGER_REVIEW',
    schoolId: null,
    schoolName: null,
    escortCategory: 'myeduride_escort',
  };

  const targetSchool = {
    id: 'SCH-LAG-001',
    name: 'Corona Secondary School, Victoria Island',
  };

  const approvedEscort = quickApproveAndAssignSchool(
    pendingEscort,
    targetSchool,
    'Verified NIN & driver licence. Assigned to Corona Secondary bus fleet.'
  );

  expect(approvedEscort.status).toBe('CITY_MANAGER_APPROVED');
  expect(approvedEscort.schoolId).toBe('SCH-LAG-001');
  expect(approvedEscort.schoolName).toBe('Corona Secondary School, Victoria Island');
  expect(approvedEscort.escortCategory).toBe('school_escort');
  expect(approvedEscort.notes).toContain('Corona Secondary bus fleet');
});

// 2. Invariant: Guard against missing school in quick approve and assign
cityManagerEscortApprovalSuite.test('Invariant 2: Quick assignment rejects missing school selection', () => {
  const validateQuickApprovalInput = (input: { escortId?: string; schoolId?: string }) => {
    if (!input.escortId) {
      return { valid: false, error: 'Escort Application ID is required' };
    }
    if (!input.schoolId || input.schoolId.trim() === '') {
      return { valid: false, error: 'Target school must be selected for assignment' };
    }
    return { valid: true, error: null };
  };

  const invalidAttempt = validateQuickApprovalInput({
    escortId: 'ESC-APP-990',
    schoolId: '',
  });

  expect(invalidAttempt.valid).toBe(false);
  expect(invalidAttempt.error).toContain('Target school must be selected');

  const validAttempt = validateQuickApprovalInput({
    escortId: 'ESC-APP-990',
    schoolId: 'SCH-002',
  });

  expect(validAttempt.valid).toBe(true);
  expect(validAttempt.error).toBeNull();
});

// 3. Invariant: Resolve assigned students manifest for approved escort
cityManagerEscortApprovalSuite.test('Invariant 3: Resolve student manifest with pinned home GPS and parent contact', () => {
  type AssignmentRecord = {
    id: string;
    escort_application_id: string;
    school_id: string;
    student_id: string;
    status: string;
    created_at: string;
    school: { id: string; name: string };
    student: {
      id: string;
      first_name: string;
      last_name: string;
      student_id_number: string;
      photo_url?: string | null;
      class_name: string;
      house_address: string;
      house_lat: number | null;
      house_lng: number | null;
      parent_phone: string;
    };
  };

  const resolveEscortStudentsManifest = (
    escortId: string,
    assignments: AssignmentRecord[]
  ) => {
    const matched = assignments.filter(
      (a) => a.escort_application_id === escortId && ['active', 'pending_confirmation'].includes(a.status)
    );

    return matched.map((a) => ({
      studentId: a.student.id,
      assignmentId: a.id,
      fullName: `${a.student.first_name} ${a.student.last_name}`,
      studentIdNumber: a.student.student_id_number,
      className: a.student.class_name,
      schoolName: a.school.name,
      houseAddress: a.student.house_address,
      houseLat: a.student.house_lat,
      houseLng: a.student.house_lng,
      isPinned: a.student.house_lat !== null && a.student.house_lng !== null,
      parentPhone: a.student.parent_phone,
      assignmentStatus: a.status,
    }));
  };

  const mockAssignments: AssignmentRecord[] = [
    {
      id: 'ASS-001',
      escort_application_id: 'ESC-APP-881',
      school_id: 'SCH-LAG-001',
      student_id: 'STU-101',
      status: 'active',
      created_at: '2026-09-12T08:00:00Z',
      school: { id: 'SCH-LAG-001', name: 'Corona Secondary School' },
      student: {
        id: 'STU-101',
        first_name: 'Zainab',
        last_name: 'Balogun',
        student_id_number: 'CSS-2026-042',
        photo_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
        class_name: 'JSS 2 Diamond',
        house_address: '12 Bourdillon Road, Ikoyi',
        house_lat: 6.4468,
        house_lng: 3.4354,
        parent_phone: '+2348031234567',
      },
    },
    {
      id: 'ASS-002',
      escort_application_id: 'ESC-APP-881',
      school_id: 'SCH-LAG-001',
      student_id: 'STU-102',
      status: 'active',
      created_at: '2026-09-12T08:05:00Z',
      school: { id: 'SCH-LAG-001', name: 'Corona Secondary School' },
      student: {
        id: 'STU-102',
        first_name: 'Chinedu',
        last_name: 'Eze',
        student_id_number: 'CSS-2026-088',
        photo_url: null,
        class_name: 'SS 1 Gold',
        house_address: '25 Alexander Avenue, Ikoyi',
        house_lat: 6.4521,
        house_lng: 3.4402,
        parent_phone: '+2348099887766',
      },
    },
    {
      id: 'ASS-003',
      escort_application_id: 'OTHER-ESCORT',
      school_id: 'SCH-LAG-001',
      student_id: 'STU-103',
      status: 'active',
      created_at: '2026-09-12T08:10:00Z',
      school: { id: 'SCH-LAG-001', name: 'Corona Secondary School' },
      student: {
        id: 'STU-103',
        first_name: 'Tunde',
        last_name: 'Bakare',
        student_id_number: 'CSS-2026-099',
        photo_url: null,
        class_name: 'JSS 1 Ruby',
        house_address: 'Parkview Estate',
        house_lat: null,
        house_lng: null,
        parent_phone: '+2348011223344',
      },
    },
  ];

  const escortManifest = resolveEscortStudentsManifest('ESC-APP-881', mockAssignments);

  expect(escortManifest.length).toBe(2);
  expect(escortManifest[0].fullName).toBe('Zainab Balogun');
  expect(escortManifest[0].studentIdNumber).toBe('CSS-2026-042');
  expect(escortManifest[0].isPinned).toBe(true);
  expect(escortManifest[0].parentPhone).toBe('+2348031234567');
  expect(escortManifest[1].fullName).toBe('Chinedu Eze');
  expect(escortManifest[1].houseAddress).toBe('25 Alexander Avenue, Ikoyi');
});

// 4. Invariant: Escort with 0 assignments safely returns empty roster
cityManagerEscortApprovalSuite.test('Invariant 4: Escort without assigned students gracefully reports 0 count and empty manifest', () => {
  const evaluateEscortStudentRoster = (escort: {
    id: string;
    assigned_students?: any[];
    assigned_students_count?: number;
  }) => {
    const list = Array.isArray(escort.assigned_students) ? escort.assigned_students : [];
    const count = typeof escort.assigned_students_count === 'number' ? escort.assigned_students_count : list.length;
    return {
      hasStudents: count > 0,
      count,
      students: list,
    };
  };

  const newApprovedEscort = {
    id: 'ESC-APP-999',
    assigned_students: [],
    assigned_students_count: 0,
  };

  const result = evaluateEscortStudentRoster(newApprovedEscort);
  expect(result.hasStudents).toBe(false);
  expect(result.count).toBe(0);
  expect(result.students.length).toBe(0);
});

// 5. Invariant: City Manager Audit Trail & Notifications for Quick Approval
cityManagerEscortApprovalSuite.test('Invariant 5: Audit ledger event logged with actor, school ID, and escort entity', () => {
  const createCityManagerAuditRecord = (params: {
    actorUserId: string;
    escortId: string;
    schoolId: string;
    schoolName: string;
    notes: string;
  }) => {
    return {
      actor_user_id: params.actorUserId,
      action: 'ESCORT_QUICK_APPROVED_AND_ASSIGNED_SCHOOL',
      entity_type: 'escort_application',
      entity_id: params.escortId,
      details: {
        school_id: params.schoolId,
        school_name: params.schoolName,
        notes: params.notes,
      },
      timestamp: new Date().toISOString(),
    };
  };

  const auditLog = createCityManagerAuditRecord({
    actorUserId: 'CM-USER-001',
    escortId: 'ESC-APP-881',
    schoolId: 'SCH-LAG-001',
    schoolName: 'Corona Secondary School',
    notes: 'Approved and dispatched to morning routes',
  });

  expect(auditLog.action).toBe('ESCORT_QUICK_APPROVED_AND_ASSIGNED_SCHOOL');
  expect(auditLog.entity_type).toBe('escort_application');
  expect(auditLog.entity_id).toBe('ESC-APP-881');
  expect(auditLog.details.school_id).toBe('SCH-LAG-001');
  expect(auditLog.details.school_name).toBe('Corona Secondary School');
});

// 6. Invariant: Gate Officer Emergency Directive Dispatch
cityManagerEscortApprovalSuite.test('Invariant 6: Gate officer emergency directive dispatches with severity and action requirements', () => {
  type GateOfficerAlert = {
    gate_officer_id: string;
    officer_name: string;
    school_id?: string;
    severity: 'CRITICAL_EMERGENCY' | 'NON_COMPLIANCE_DIRECTIVE' | 'URGENT_GATE_ALERT';
    action_required: string;
    message: string;
  };

  const dispatchGateDirective = (input: GateOfficerAlert) => {
    if (!input.message || !input.message.trim()) {
      throw new Error('Message body is mandatory');
    }
    if (!input.action_required || !input.action_required.trim()) {
      throw new Error('Mandatory action required must be specified');
    }
    return {
      ...input,
      id: `DIR-${Date.now()}`,
      dispatched_at: new Date().toISOString(),
      delivered: true,
      broadcast: !input.gate_officer_id,
    };
  };

  const directive = dispatchGateDirective({
    gate_officer_id: 'GO-001',
    officer_name: 'Sgt. Adeyemi',
    school_id: 'SCH-LAG-001',
    severity: 'NON_COMPLIANCE_DIRECTIVE',
    action_required: 'Verify digital student authorization immediately',
    message: 'Halt all manual student gate overrides immediately without scanned QR pass.',
  });

  expect(directive.severity).toBe('NON_COMPLIANCE_DIRECTIVE');
  expect(directive.delivered).toBe(true);
  expect(directive.broadcast).toBe(false);
  expect(directive.action_required).toBe('Verify digital student authorization immediately');
});

// 7. Invariant: School Census Student Roster Inspection
cityManagerEscortApprovalSuite.test('Invariant 7: School census roster resolves student profiles with pinned GPS verification', () => {
  const schoolStudents = [
    { id: 'STU-1', first_name: 'Ade', last_name: 'Cole', house_lat: 6.45, house_lng: 3.42 },
    { id: 'STU-2', first_name: 'Kemi', last_name: 'Adeleke', house_lat: null, house_lng: null },
  ];

  const audited = schoolStudents.map((s) => ({
    ...s,
    hasGpsPin: Boolean(s.house_lat && s.house_lng),
  }));

  expect(audited[0].hasGpsPin).toBe(true);
  expect(audited[1].hasGpsPin).toBe(false);
});

// 8. Invariant: Accountant-Approved Parent Discount Ledger
cityManagerEscortApprovalSuite.test('Invariant 8: Parent discount computation updates net payable and accountant audit record', () => {
  const computeDiscountedBooking = (originalFare: number, discountPercent: number, bursarApprovalRef: string) => {
    if (discountPercent < 0 || discountPercent > 100) {
      throw new Error('Invalid discount range');
    }
    const discountAmount = (originalFare * discountPercent) / 100;
    const netPayable = originalFare - discountAmount;
    return {
      originalFare,
      discountPercent,
      discountAmount,
      netPayable,
      bursarApprovalRef,
      status: 'DISCOUNT_APPLIED',
    };
  };

  const concession = computeDiscountedBooking(25000, 20, 'BURSAR-CONCESSION-2026-004');
  expect(concession.discountAmount).toBe(5000);
  expect(concession.netPayable).toBe(20000);
  expect(concession.bursarApprovalRef).toBe('BURSAR-CONCESSION-2026-004');
  expect(concession.status).toBe('DISCOUNT_APPLIED');
});

