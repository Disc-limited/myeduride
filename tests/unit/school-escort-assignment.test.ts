import { TestSuite, expect } from '../utils/test-harness';

export const schoolEscortAssignmentSuite = new TestSuite(
  'School Escort Assignment & City Manager Immediate Clearance Suite',
  'UNIT'
);

// 1. Invariant: Only students with pinned house addresses are eligible for assignment
schoolEscortAssignmentSuite.test('Invariant 1: Student must have parent pinned address before escort assignment', () => {
  const evaluateStudentEligibility = (student: {
    id: string;
    first_name: string;
    last_name: string;
    house_address?: string | null;
    house_lat?: number | null;
    house_lng?: number | null;
  }) => {
    const isPinned =
      student.house_lat !== null &&
      student.house_lat !== undefined &&
      student.house_lng !== null &&
      student.house_lng !== undefined &&
      Boolean(student.house_address && student.house_address.trim().length > 0);

    if (!isPinned) {
      return {
        eligible: false,
        reason: 'Student address is not pinned by parent. Escort assignment requires doorstep coordinates.',
      };
    }

    return {
      eligible: true,
      student_id: student.id,
      house_address: student.house_address,
      lat: student.house_lat,
      lng: student.house_lng,
    };
  };

  // Pinned Student
  const pinnedStudent = {
    id: 'STU-001',
    first_name: 'David',
    last_name: 'Adeleke',
    house_address: '14 Admiralty Way, Lekki Phase 1',
    house_lat: 6.4474,
    house_lng: 3.4731,
  };
  const eligibleResult = evaluateStudentEligibility(pinnedStudent);
  expect(eligibleResult.eligible).toBe(true);

  // Unpinned Student (No coordinates)
  const unpinnedStudent1 = {
    id: 'STU-002',
    first_name: 'Chidinma',
    last_name: 'Okafor',
    house_address: 'Lekki, Lagos',
    house_lat: null,
    house_lng: null,
  };
  const ineligibleResult1 = evaluateStudentEligibility(unpinnedStudent1);
  expect(ineligibleResult1.eligible).toBe(false);
  expect(ineligibleResult1.reason).toContain('not pinned');

  // Unpinned Student (No address string)
  const unpinnedStudent2 = {
    id: 'STU-003',
    first_name: 'Femi',
    last_name: 'Bello',
    house_address: '',
    house_lat: 6.45,
    house_lng: 3.48,
  };
  const ineligibleResult2 = evaluateStudentEligibility(unpinnedStudent2);
  expect(ineligibleResult2.eligible).toBe(false);
});

// 2. Distance and Fare Calculation Engine
schoolEscortAssignmentSuite.test('Invariant 2: Haversine distance and tiered fare calculation engine', () => {
  const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(1));
  };

  const calculateTripFares = (distanceKm: number, tripType: 'two_way' | 'morning_only' | 'afternoon_only') => {
    const baseFare = 1000;
    const perKmRate = 150;
    const singleTrip = Math.round(baseFare + distanceKm * perKmRate);

    const morning = tripType === 'afternoon_only' ? 0 : singleTrip;
    const afternoon = tripType === 'morning_only' ? 0 : singleTrip;
    const dailyTotal = morning + afternoon;

    return {
      distanceKm,
      morning,
      afternoon,
      dailyTotal,
    };
  };

  // Gracefield Lekki (6.4474, 3.4731) to Victoria Island (6.4281, 3.4219)
  const distance = calculateDistanceKm(6.4474, 3.4731, 6.4281, 3.4219);
  expect(distance > 5 && distance < 8).toBe(true);

  const faresTwoWay = calculateTripFares(5.0, 'two_way');
  // singleTrip = 1000 + 5.0 * 150 = 1750
  expect(faresTwoWay.morning).toBe(1750);
  expect(faresTwoWay.afternoon).toBe(1750);
  expect(faresTwoWay.dailyTotal).toBe(3500);

  const faresMorningOnly = calculateTripFares(5.0, 'morning_only');
  expect(faresMorningOnly.morning).toBe(1750);
  expect(faresMorningOnly.afternoon).toBe(0);
  expect(faresMorningOnly.dailyTotal).toBe(1750);
});

// 3. School Admin Assignment Creation and Immediate CM Approval Flow
schoolEscortAssignmentSuite.test('Invariant 3: School Admin creates pending assignment -> CM approves immediately with PIN', () => {
  // Step A: School Admin assignment payload
  const createAssignment = (params: {
    student_id: string;
    student_is_pinned: boolean;
    escort_id: string;
    escort_type: 'school_escort' | 'myeduride_escort';
  }) => {
    if (!params.student_is_pinned) {
      throw new Error('Cannot assign student without pinned house address');
    }

    return {
      booking_id: `TB-SCH-${Date.now()}`,
      student_id: params.student_id,
      escort_id: params.escort_id,
      escort_type: params.escort_type,
      source: 'school',
      status: 'pending',
      cm_approval_status: 'pending_confirmation',
      created_at: new Date().toISOString(),
    };
  };

  const assignment = createAssignment({
    student_id: 'STU-100',
    student_is_pinned: true,
    escort_id: 'ESC-APP-500',
    escort_type: 'myeduride_escort',
  });

  expect(assignment.status).toBe('pending');
  expect(assignment.source).toBe('school');

  // Step B: City Manager immediate clearance
  const approveAssignment = (assignedItem: any) => {
    const securityPin = Math.floor(100000 + Math.random() * 900000).toString();
    return {
      ...assignedItem,
      status: 'assigned',
      cm_approval_status: 'active',
      security_pin: securityPin,
      approved_at: new Date().toISOString(),
      parent_notified: true,
      escort_notified: true,
    };
  };

  const cleared = approveAssignment(assignment);
  expect(cleared.status).toBe('assigned');
  expect(cleared.cm_approval_status).toBe('active');
  expect(cleared.security_pin.length).toBe(6);
  expect(cleared.parent_notified).toBe(true);
  expect(cleared.escort_notified).toBe(true);
});

// 4. Batch clearance by City Manager
schoolEscortAssignmentSuite.test('Invariant 4: City Manager batch clears all pending school assignments in single action', () => {
  const pendingQueue = [
    { booking_id: 'TB-1', source: 'school', status: 'pending', student_name: 'Alice' },
    { booking_id: 'TB-2', source: 'school', status: 'pending', student_name: 'Bob' },
    { booking_id: 'TB-3', source: 'parent', status: 'pending', student_name: 'Charlie' },
  ];

  const batchApproveSchoolAssignments = (queue: any[]) => {
    const schoolItems = queue.filter((i) => i.source === 'school' && i.status === 'pending');
    const clearedItems = schoolItems.map((item) => ({
      ...item,
      status: 'assigned',
      security_pin: '778899',
      approved_at: new Date().toISOString(),
    }));

    return {
      approved_count: clearedItems.length,
      cleared_items: clearedItems,
    };
  };

  const batchResult = batchApproveSchoolAssignments(pendingQueue);
  expect(batchResult.approved_count).toBe(2);
  expect(batchResult.cleared_items[0].status).toBe('assigned');
  expect(batchResult.cleared_items[1].status).toBe('assigned');
});
