import { TestSuite, expect } from '../utils/test-harness';

export const parentAddressPinningSuite = new TestSuite(
  'Parent Address Pinning & Multi-Dashboard Synchronization Suite',
  'UNIT'
);

// 1. Parent Address Typing & Validation Invariants
parentAddressPinningSuite.test('Invariant 1: Parent must type non-empty street address with valid GPS coordinates', () => {
  const validateParentHousePin = (payload: {
    student_id?: string;
    house_address?: string;
    house_lat?: number;
    house_lng?: number;
    house_landmark?: string;
    house_notes?: string;
  }) => {
    if (!payload.student_id) {
      throw new Error('student_id is required');
    }
    const cleanAddress = payload.house_address?.trim();
    if (!cleanAddress || cleanAddress.length < 5) {
      throw new Error('A valid house street address (at least 5 characters) must be typed by parent');
    }
    const lat = Number(payload.house_lat);
    const lng = Number(payload.house_lng);
    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      throw new Error('Valid GPS coordinates are required');
    }

    return {
      student_id: payload.student_id,
      house_address: cleanAddress,
      house_lat: lat,
      house_lng: lng,
      house_landmark: payload.house_landmark?.trim() || null,
      house_notes: payload.house_notes?.trim() || null,
      is_pinned: true,
      pinned_at: new Date().toISOString(),
    };
  };

  // Valid submission with typed address
  const result = validateParentHousePin({
    student_id: 'STU-101',
    house_address: 'Plot 14B, Admiralty Way, Lekki Phase 1, Lagos',
    house_lat: 6.4474,
    house_lng: 3.4731,
    house_landmark: 'Opposite Ebeano Supermarket, Black Gate',
    house_notes: 'Call mom 5 minutes before bus arrival',
  });

  expect(result.is_pinned).toBeTruthy();
  expect(result.house_address).toBe('Plot 14B, Admiralty Way, Lekki Phase 1, Lagos');
  expect(result.house_landmark).toBe('Opposite Ebeano Supermarket, Black Gate');
  expect(result.house_lat).toBe(6.4474);

  // Rejection of empty typed address
  let emptyAddressFailed = false;
  try {
    validateParentHousePin({
      student_id: 'STU-102',
      house_address: '   ',
      house_lat: 6.4474,
      house_lng: 3.4731,
    });
  } catch (err: any) {
    emptyAddressFailed = true;
    expect(err.message).toContain('house street address');
  }
  expect(emptyAddressFailed).toBeTruthy();

  // Rejection of invalid coordinates
  let invalidCoordsFailed = false;
  try {
    validateParentHousePin({
      student_id: 'STU-103',
      house_address: '15 Victoria Island Road, Lagos',
      house_lat: 999, // invalid latitude
      house_lng: 3.4731,
    });
  } catch (err: any) {
    invalidCoordsFailed = true;
    expect(err.message).toContain('Valid GPS coordinates');
  }
  expect(invalidCoordsFailed).toBeTruthy();
});

// 2. School Route Synchronization: Includes both Route-Assigned & Unassigned Pinned Students
parentAddressPinningSuite.test('Invariant 2: School Route dashboard resolves ALL pinned students regardless of route assignment status', () => {
  const schoolId = 'SCH-GRACE-01';

  const allSchoolStudents = [
    { id: 'STU-1', name: 'Zainab Danjuma', school_id: schoolId, house_address: '12 Isaac John St, GRA Ikeja', house_lat: 6.5921, house_lng: 3.3562 },
    { id: 'STU-2', name: 'Chukwuebuka Obi', school_id: schoolId, house_address: '45 Bode Thomas St, Surulere', house_lat: 6.4952, house_lng: 3.3581 },
    { id: 'STU-3', name: 'Amina Bello', school_id: schoolId, house_address: 'Plot 8, Victoria Garden City, Lekki', house_lat: 6.4351, house_lng: 3.5672 },
    { id: 'STU-4', name: 'Emeka Okeke', school_id: schoolId, house_address: null, house_lat: null, house_lng: null }, // Not yet pinned
  ];

  // Only STU-1 is currently assigned to a route
  const studentRouteAssignments = [
    { student_id: 'STU-1', morning_route_id: 'ROUTE-01', route_code: 'RT-01', route_name: 'Ikeja Mainland Express' },
  ];

  // Resolver simulating /api/school-admin/routes
  const resolveSchoolPinnedDoorsteps = (students: typeof allSchoolStudents, assignments: typeof studentRouteAssignments) => {
    const assignedMap = new Map(assignments.map((a) => [a.student_id, a]));

    const pinnedList = students
      .filter((s) => s.house_lat != null && s.house_lng != null)
      .map((s) => {
        const assigned = assignedMap.get(s.id);
        return {
          student_id: s.id,
          name: s.name,
          house_address: s.house_address,
          house_lat: s.house_lat,
          house_lng: s.house_lng,
          is_route_assigned: Boolean(assigned),
          route_code: assigned?.route_code || 'UNASSIGNED',
          route_name: assigned?.route_name || 'Awaiting Corridor Assignment',
        };
      });

    return {
      all_pinned_students: pinnedList,
      total_pinned_count: pinnedList.length,
      unassigned_count: pinnedList.filter((s) => !s.is_route_assigned).length,
      assigned_count: pinnedList.filter((s) => s.is_route_assigned).length,
    };
  };

  const resolved = resolveSchoolPinnedDoorsteps(allSchoolStudents, studentRouteAssignments);

  // Must find 3 pinned students even though only 1 is assigned to ROUTE-01
  expect(resolved.total_pinned_count).toBe(3);
  expect(resolved.assigned_count).toBe(1);
  expect(resolved.unassigned_count).toBe(2);

  const stu2 = resolved.all_pinned_students.find((s) => s.student_id === 'STU-2');
  expect(stu2?.house_address).toBe('45 Bode Thomas St, Surulere');
  expect(stu2?.is_route_assigned).toBeFalsy();
  expect(stu2?.route_code).toBe('UNASSIGNED');

  const stu3 = resolved.all_pinned_students.find((s) => s.student_id === 'STU-3');
  expect(stu3?.house_address).toBe('Plot 8, Victoria Garden City, Lekki');
});

// 3. City Manager Multi-School Doorstep Registry Aggregation
parentAddressPinningSuite.test('Invariant 3: City Manager operations API aggregates pinned parent addresses across all city schools', () => {
  const rawCityStudents = [
    {
      id: 'STU-A1',
      first_name: 'David',
      last_name: 'Adeleke',
      school_id: 'SCH-01',
      school_name: 'Grace International School',
      class_name: 'Grade 4A',
      house_address: '77 Awolowo Road, Ikoyi, Lagos',
      house_landmark: 'Beside Mobil Station',
      house_lat: 6.4485,
      house_lng: 3.4271,
      house_pinned_at: '2026-09-10T14:00:00Z',
    },
    {
      id: 'STU-B1',
      first_name: 'Khadijah',
      last_name: 'Ahmed',
      school_id: 'SCH-02',
      school_name: 'St. Saviour Academy',
      class_name: 'Basic 2',
      house_address: '14 Marine Road, Apapa, Lagos',
      house_landmark: 'Near NPA Quarters, Yellow Gate',
      house_lat: 6.4412,
      house_lng: 3.3641,
      house_pinned_at: '2026-09-11T08:30:00Z',
    },
  ];

  const escortAssignments = [
    { student_id: 'STU-A1', escort_name: 'Ibrahim Garba', escort_phone: '08022233344', status: 'active' },
  ];

  // Simulating City Manager Pinned Addresses Transformation
  const aggregateCityManagerPinnedAddresses = (students: typeof rawCityStudents, assignments: typeof escortAssignments) => {
    return students.map((s) => {
      const match = assignments.find((a) => a.student_id === s.id && a.status === 'active');
      return {
        student_id: s.id,
        student_name: `${s.first_name} ${s.last_name}`,
        school_id: s.school_id,
        school_name: s.school_name,
        class_name: s.class_name,
        house_address: s.house_address,
        house_landmark: s.house_landmark,
        house_lat: s.house_lat,
        house_lng: s.house_lng,
        assigned_escort_name: match?.escort_name || null,
        is_assigned: Boolean(match),
        google_maps_url: `https://www.google.com/maps/dir/?api=1&destination=${s.house_lat},${s.house_lng}`,
      };
    });
  };

  const cityRegistry = aggregateCityManagerPinnedAddresses(rawCityStudents, escortAssignments);

  expect(cityRegistry.length).toBe(2);
  expect(cityRegistry[0].house_address).toBe('77 Awolowo Road, Ikoyi, Lagos');
  expect(cityRegistry[0].assigned_escort_name).toBe('Ibrahim Garba');
  expect(cityRegistry[0].is_assigned).toBeTruthy();

  expect(cityRegistry[1].house_address).toBe('14 Marine Road, Apapa, Lagos');
  expect(cityRegistry[1].is_assigned).toBeFalsy();
  expect(cityRegistry[1].google_maps_url).toContain('6.4412,3.3641');
});

// 4. Escort View Address Precedence (Parent-typed house address takes precedence)
parentAddressPinningSuite.test('Invariant 4: Escort turn-by-turn route prioritizes parent-typed house address over generic corridor stop', () => {
  const student = {
    id: 'STU-99',
    first_name: 'Ngozi',
    last_name: 'Eze',
    house_address: 'House 5, Ocean Palms Estate, Lekki',
    house_landmark: 'Black gate opposite tennis court',
    house_lat: 6.4388,
    house_lng: 3.4912,
    pickup_address: null,
    designated_route_stop: 'Lekki Toll Gate 2',
  };

  const resolveEscortDeliveryTarget = (st: typeof student) => {
    const addressToDisplay = st.house_address || st.pickup_address || st.designated_route_stop;
    const hasCoordinates = st.house_lat != null && st.house_lng != null;
    const navUrl = hasCoordinates
      ? `https://www.google.com/maps/dir/?api=1&destination=${st.house_lat},${st.house_lng}`
      : null;

    return {
      student_id: st.id,
      delivery_address: addressToDisplay,
      landmark: st.house_landmark,
      navigation_url: navUrl,
      is_doorstep_pinned: hasCoordinates,
    };
  };

  const target = resolveEscortDeliveryTarget(student);

  expect(target.delivery_address).toBe('House 5, Ocean Palms Estate, Lekki');
  expect(target.is_doorstep_pinned).toBeTruthy();
  expect(target.navigation_url).toContain('6.4388,3.4912');
  expect(target.landmark).toBe('Black gate opposite tennis court');
});
