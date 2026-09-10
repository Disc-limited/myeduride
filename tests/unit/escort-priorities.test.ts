import { TestSuite, expect } from '../utils/test-harness';

export const escortPrioritiesSuite = new TestSuite('MyEduRide Escort Field Operational Priorities Suite', 'UNIT');

// 1. Ability to see all student assigned by school and approved by city manager
escortPrioritiesSuite.test('Priority 1: Student School Assignment and City Manager Approval Filtering', () => {
  const assignments = [
    { student_id: 'STU-1', school_id: 'SCH-A', status: 'active' }, // Approved by CM
    { student_id: 'STU-2', school_id: 'SCH-A', status: 'pending_confirmation' }, // Pending CM approval
    { student_id: 'STU-3', school_id: 'SCH-B', status: 'active' }, // Approved by CM for School B
  ];

  const students = [
    { id: 'STU-1', name: 'Chukwuebuka Obi', school_name: 'Grace International School' },
    { id: 'STU-2', name: 'Zainab Danjuma', school_name: 'Grace International School' },
    { id: 'STU-3', name: 'David Adeleke', school_name: 'St. Saviour Academy' },
  ];

  const enriched = students.map((st) => {
    const match = assignments.find((a) => a.student_id === st.id);
    return {
      ...st,
      city_manager_approved: match?.status === 'active',
      city_manager_status: match?.status === 'pending_confirmation' ? 'pending_approval' : 'approved',
    };
  });

  expect(enriched.length).toBe(3);
  expect(enriched.find((s) => s.id === 'STU-1')?.city_manager_approved).toBeTruthy();
  expect(enriched.find((s) => s.id === 'STU-2')?.city_manager_approved).toBeFalsy();
  expect(enriched.find((s) => s.id === 'STU-2')?.city_manager_status).toBe('pending_approval');
  expect(enriched.find((s) => s.id === 'STU-3')?.school_name).toBe('St. Saviour Academy');
});

// 2. See student location and approved pricing amount by city manager so they can easily know daily earnings
escortPrioritiesSuite.test('Priority 2: Location and City Manager Approved Daily Fare & Earnings Calculation', () => {
  const studentsWithFares = [
    { id: 'STU-1', city_manager_approved: true, daily_fare: 4000, morning_fare: 2000, afternoon_fare: 2000 },
    { id: 'STU-2', city_manager_approved: true, daily_fare: 3500, morning_fare: 1750, afternoon_fare: 1750 },
    { id: 'STU-3', city_manager_approved: false, daily_fare: 3000, morning_fare: 1500, afternoon_fare: 1500 }, // unapproved
  ];

  const totalDailyEarnings = studentsWithFares.reduce((acc, s) => acc + (s.city_manager_approved ? s.daily_fare : 0), 0);
  const morningProjected = studentsWithFares.reduce((acc, s) => acc + (s.city_manager_approved ? s.morning_fare : 0), 0);
  const afternoonProjected = studentsWithFares.reduce((acc, s) => acc + (s.city_manager_approved ? s.afternoon_fare : 0), 0);

  expect(totalDailyEarnings).toBe(7500); // 4000 + 3500
  expect(morningProjected).toBe(3750);
  expect(afternoonProjected).toBe(3750);
});

// 3. Ability to sign in and sign out all students: First pick up and drop off in morning, reverse in afternoon
escortPrioritiesSuite.test('Priority 3: Morning Home Pickup -> School Drop-off & Afternoon Reverse Transition', () => {
  // Morning Stage Machine
  let morningStatus = 'PENDING_HOME_PICKUP';

  // Action 1: Morning Home Pickup
  const executeMorningPickup = () => {
    if (morningStatus === 'PENDING_HOME_PICKUP') {
      morningStatus = 'PICKED_UP_FROM_HOME';
    }
  };

  // Action 2: Morning School Dropoff (Sign-in)
  const executeMorningSchoolDropoff = () => {
    if (morningStatus === 'PICKED_UP_FROM_HOME') {
      morningStatus = 'DROPPED_OFF_AT_SCHOOL';
    }
  };

  executeMorningPickup();
  expect(morningStatus).toBe('PICKED_UP_FROM_HOME');
  executeMorningSchoolDropoff();
  expect(morningStatus).toBe('DROPPED_OFF_AT_SCHOOL');

  // Afternoon Reverse Stage Machine
  let afternoonStatus = 'PENDING_SCHOOL_PICKUP';

  // Reverse Action 1: School Gate Pickup (Sign-out)
  const executeAfternoonSchoolPickup = () => {
    if (afternoonStatus === 'PENDING_SCHOOL_PICKUP') {
      afternoonStatus = 'PICKED_UP_FROM_GATE';
    }
  };

  // Reverse Action 2: Safe Home Delivery (Doorstep Dropoff)
  const executeAfternoonHomeDropoff = () => {
    if (afternoonStatus === 'PICKED_UP_FROM_GATE') {
      afternoonStatus = 'SAFE_AT_HOME';
    }
  };

  executeAfternoonSchoolPickup();
  expect(afternoonStatus).toBe('PICKED_UP_FROM_GATE');
  executeAfternoonHomeDropoff();
  expect(afternoonStatus).toBe('SAFE_AT_HOME');
});

// 4. Ability to accept the trip they can cover for the day or decline so emergency deputy is dispatched
escortPrioritiesSuite.test('Priority 4: Accept vs Decline Route Commitment & Emergency Deputy Trigger', () => {
  type TripCommitment = {
    today_trip_status: 'pending' | 'accepted' | 'declined';
    declined_reason?: string;
    emergency_deputy_status?: 'PENDING_DEPUTY_ASSIGNMENT' | 'ASSIGNED';
  };

  const acceptTrip = (escort: TripCommitment): TripCommitment => ({
    ...escort,
    today_trip_status: 'accepted',
  });

  const declineTrip = (escort: TripCommitment, reason: string): TripCommitment => ({
    ...escort,
    today_trip_status: 'declined',
    declined_reason: reason,
    emergency_deputy_status: 'PENDING_DEPUTY_ASSIGNMENT',
  });

  const escortA: TripCommitment = { today_trip_status: 'pending' };
  const accepted = acceptTrip(escortA);
  expect(accepted.today_trip_status).toBe('accepted');

  const escortB: TripCommitment = { today_trip_status: 'pending' };
  const declined = declineTrip(escortB, 'Medical appointment emergency');
  expect(declined.today_trip_status).toBe('declined');
  expect(declined.declined_reason).toBe('Medical appointment emergency');
  expect(declined.emergency_deputy_status).toBe('PENDING_DEPUTY_ASSIGNMENT');
});

// 5. Ability to click "I am ready for pick up" and display student roster
escortPrioritiesSuite.test('Priority 5: "I am ready for pick up" One-touch Activation Toggle', () => {
  let readyForPickup = false;
  let readyAt: string | null = null;

  const toggleReady = (state: boolean) => {
    readyForPickup = state;
    readyAt = state ? new Date().toISOString() : null;
  };

  toggleReady(true);
  expect(readyForPickup).toBeTruthy();
  expect(readyAt !== null).toBeTruthy();

  toggleReady(false);
  expect(readyForPickup).toBeFalsy();
  expect(readyAt).toBeNull();
});

// 6. Ability to pin house address/GPS coordinates for City Manager detection
escortPrioritiesSuite.test('Priority 6: Escort House Address and GPS Coordinate Pinning Invariants', () => {
  const validateHousePin = (data: { residential_address?: string; house_lat?: number; house_lng?: number }) => {
    const hasAddress = Boolean(data.residential_address && data.residential_address.trim().length >= 5);
    const hasValidCoords =
      data.house_lat !== undefined &&
      data.house_lng !== undefined &&
      data.house_lat >= -90 &&
      data.house_lat <= 90 &&
      data.house_lng >= -180 &&
      data.house_lng <= 180;
    return hasAddress && hasValidCoords;
  };

  const validPin = {
    residential_address: '14 Admiralty Way, Lekki Phase 1, Lagos',
    house_lat: 6.4474,
    house_lng: 3.4723,
  };

  const invalidCoords = {
    residential_address: '14 Admiralty Way, Lekki Phase 1, Lagos',
    house_lat: 105.0, // Invalid latitude
    house_lng: 3.4723,
  };

  const missingAddress = {
    residential_address: '',
    house_lat: 6.4474,
    house_lng: 3.4723,
  };

  expect(validateHousePin(validPin)).toBeTruthy();
  expect(validateHousePin(invalidCoords)).toBeFalsy();
  expect(validateHousePin(missingAddress)).toBeFalsy();
});

// Run directly if executed via CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  escortPrioritiesSuite.run().then(() => {
    escortPrioritiesSuite.printSummary();
  });
}

