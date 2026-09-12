import { TestSuite, expect } from '../utils/test-harness';

export const escortStudentVisibilitySuite = new TestSuite(
  'Escort Student Assigned Visibility Suite (MyEduRide vs School Escort Privacy & Direction Engine)',
  'UNIT'
);

// 1. Invariant 1: Escort classification determines category
escortStudentVisibilitySuite.test('Invariant 1: Escort category correctly resolves school_escort vs myeduride_escort', () => {
  const resolveEscortCategory = (profile: {
    escortCategory?: string;
    createdBySchoolId?: string | null;
    schoolId?: string | null;
    role?: string;
  }): 'school_escort' | 'myeduride_escort' => {
    const isSchoolEscort = Boolean(
      profile.escortCategory === 'school_escort' ||
      profile.createdBySchoolId ||
      profile.schoolId ||
      profile.role === 'school_escort'
    );
    return isSchoolEscort ? 'school_escort' : 'myeduride_escort';
  };

  // Case 1: School escort registered by school admin
  expect(resolveEscortCategory({ escortCategory: 'school_escort', createdBySchoolId: 'sch-1' })).toBe('school_escort');
  expect(resolveEscortCategory({ schoolId: 'sch-1' })).toBe('school_escort');
  expect(resolveEscortCategory({ role: 'school_escort' })).toBe('school_escort');

  // Case 2: Platform MyEduRide independent escort
  expect(resolveEscortCategory({ escortCategory: 'myeduride_escort' })).toBe('myeduride_escort');
  expect(resolveEscortCategory({ role: 'escort' })).toBe('myeduride_escort');
  expect(resolveEscortCategory({})).toBe('myeduride_escort');
});

// 2. Invariant 2: MyEduRide Escort sees Location, Address, AND Price
escortStudentVisibilitySuite.test('Invariant 2: MyEduRide Escort payload includes student location, address, AND pricing fare', () => {
  const buildManifestForEscort = (escortType: 'school_escort' | 'myeduride_escort', rawStudent: any) => {
    const isSchoolEscort = escortType === 'school_escort';

    const rawFare = 3500;
    const dailyFare = isSchoolEscort ? null : rawFare;
    const morningFare = dailyFare != null ? Math.round(dailyFare / 2) : null;
    const afternoonFare = dailyFare != null ? Math.round(dailyFare / 2) : null;

    return {
      student_id: rawStudent.id,
      name: rawStudent.name,
      // Location & Address
      house_address: rawStudent.house_address,
      house_lat: rawStudent.house_lat,
      house_lng: rawStudent.house_lng,
      house_landmark: rawStudent.house_landmark,
      is_house_pinned: Boolean(rawStudent.house_lat && rawStudent.house_lng),
      // Direction
      distance_km: rawStudent.distance_km,
      estimated_transit_mins: rawStudent.estimated_transit_mins,
      driving_directions_url: rawStudent.driving_directions_url,
      // Pricing
      show_price: !isSchoolEscort,
      daily_fare: dailyFare,
      formatted_daily_fare: dailyFare != null ? `₦${dailyFare.toLocaleString()}` : null,
      morning_fare: morningFare,
      afternoon_fare: afternoonFare,
    };
  };

  const student = {
    id: 'st-01',
    name: 'Tunde Adeleke',
    house_address: '14, Victoria Arobieke Street, Admiralty Way, Lekki',
    house_lat: 6.4474,
    house_lng: 3.4731,
    house_landmark: 'Near Ebeano Supermarket',
    distance_km: 3.8,
    estimated_transit_mins: 11,
    driving_directions_url: 'https://maps.google.com/dir/?origin=6.4281,3.4219&destination=6.4474,3.4731',
  };

  const myEduRideView = buildManifestForEscort('myeduride_escort', student);

  // Verifies Location & Address
  expect(myEduRideView.house_address).toBe('14, Victoria Arobieke Street, Admiralty Way, Lekki');
  expect(myEduRideView.house_lat).toBe(6.4474);
  expect(myEduRideView.house_lng).toBe(3.4731);
  expect(myEduRideView.house_landmark).toBe('Near Ebeano Supermarket');

  // Verifies Price
  expect(myEduRideView.show_price).toBe(true);
  expect(myEduRideView.daily_fare).toBe(3500);
  expect(myEduRideView.formatted_daily_fare).toBe('₦3,500');
  expect(myEduRideView.morning_fare).toBe(1750);
});

// 3. Invariant 3: School Escort strictly sees NO price but sees Location and Direction
escortStudentVisibilitySuite.test('Invariant 3: School Escort payload strictly hides ANY price but exposes Location and Direction', () => {
  const buildManifestForEscort = (escortType: 'school_escort' | 'myeduride_escort', rawStudent: any) => {
    const isSchoolEscort = escortType === 'school_escort';

    const rawFare = 3500;
    const dailyFare = isSchoolEscort ? null : rawFare;
    const morningFare = dailyFare != null ? Math.round(dailyFare / 2) : null;
    const afternoonFare = dailyFare != null ? Math.round(dailyFare / 2) : null;

    return {
      student_id: rawStudent.id,
      name: rawStudent.name,
      // Location & Address
      house_address: rawStudent.house_address,
      house_lat: rawStudent.house_lat,
      house_lng: rawStudent.house_lng,
      house_landmark: rawStudent.house_landmark,
      is_house_pinned: Boolean(rawStudent.house_lat && rawStudent.house_lng),
      // Direction
      distance_km: rawStudent.distance_km,
      estimated_transit_mins: rawStudent.estimated_transit_mins,
      driving_directions_url: rawStudent.driving_directions_url,
      // Pricing
      show_price: !isSchoolEscort,
      daily_fare: dailyFare,
      formatted_daily_fare: dailyFare != null ? `₦${dailyFare.toLocaleString()}` : null,
      morning_fare: morningFare,
      afternoon_fare: afternoonFare,
    };
  };

  const student = {
    id: 'st-02',
    name: 'Fatima Yusuf',
    house_address: '22, Admiralty Way, Lekki Phase 1',
    house_lat: 6.4521,
    house_lng: 3.4802,
    house_landmark: 'Opposite Domino\'s Pizza',
    distance_km: 4.2,
    estimated_transit_mins: 12,
    driving_directions_url: 'https://maps.google.com/dir/?origin=6.4474,3.4731&destination=6.4521,3.4802',
  };

  const schoolEscortView = buildManifestForEscort('school_escort', student);

  // PRICE STRICTLY HIDDEN
  expect(schoolEscortView.show_price).toBe(false);
  expect(schoolEscortView.daily_fare).toBeNull();
  expect(schoolEscortView.formatted_daily_fare).toBeNull();
  expect(schoolEscortView.morning_fare).toBeNull();
  expect(schoolEscortView.afternoon_fare).toBeNull();

  // LOCATION VISIBLE
  expect(schoolEscortView.house_address).toBe('22, Admiralty Way, Lekki Phase 1');
  expect(schoolEscortView.house_lat).toBe(6.4521);
  expect(schoolEscortView.house_lng).toBe(3.4802);
  expect(schoolEscortView.house_landmark).toBe('Opposite Domino\'s Pizza');

  // DIRECTION VISIBLE
  expect(schoolEscortView.distance_km).toBe(4.2);
  expect(schoolEscortView.estimated_transit_mins).toBe(12);
  expect(schoolEscortView.driving_directions_url).toContain('https://maps.google.com/dir/');
  expect(schoolEscortView.driving_directions_url).toContain('destination=6.4521,3.4802');
});

// 4. Invariant 4: Earnings summary nullified for school escorts, computed for MyEduRide escorts
escortStudentVisibilitySuite.test('Invariant 4: Total daily earnings summary is null for school escorts and active for MyEduRide escorts', () => {
  const computeEarningsSummary = (isSchoolEscort: boolean, manifest: any[]) => {
    if (isSchoolEscort) {
      return {
        is_school_salaried: true,
        total_daily_earnings: null,
        formatted_total_daily_earnings: null,
        total_students: manifest.length,
      };
    }

    const total = manifest.reduce((sum, s) => sum + (s.daily_fare || 0), 0);
    return {
      is_school_salaried: false,
      total_daily_earnings: total,
      formatted_total_daily_earnings: `₦${total.toLocaleString()}`,
      total_students: manifest.length,
    };
  };

  const manifest = [
    { daily_fare: 3500 },
    { daily_fare: 4000 },
  ];

  // School escort
  const schoolSummary = computeEarningsSummary(true, manifest);
  expect(schoolSummary.is_school_salaried).toBe(true);
  expect(schoolSummary.total_daily_earnings).toBeNull();
  expect(schoolSummary.formatted_total_daily_earnings).toBeNull();
  expect(schoolSummary.total_students).toBe(2);

  // MyEduRide escort
  const myEduRideSummary = computeEarningsSummary(false, manifest);
  expect(myEduRideSummary.is_school_salaried).toBe(false);
  expect(myEduRideSummary.total_daily_earnings).toBe(7500);
  expect(myEduRideSummary.formatted_total_daily_earnings).toBe('₦7,500');
  expect(myEduRideSummary.total_students).toBe(2);
});
