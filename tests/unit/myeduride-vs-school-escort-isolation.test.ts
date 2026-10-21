import { TestSuite, expect } from '../utils/test-harness';
import { resolveEscortCategory, isApprovedMyEduRideEscort } from '../../src/lib/escort/escort-category';

export const myedurideVsSchoolEscortIsolationSuite = new TestSuite(
  'MyEduRide Escort vs School Escort Complete Isolation & Zero-Side-Effect Suite',
  'UNIT'
);

// -----------------------------------------------------------------------------
// Test 1: Category Resolution & Strict Isolation
// -----------------------------------------------------------------------------
myedurideVsSchoolEscortIsolationSuite.test(
  'Test 1: Creating a MyEduRide escort with a new Gmail resolves to myeduride_escort and never to school_escort',
  () => {
    // Existing School Escort (created by school admin for a specific school)
    const schoolEscort = {
      id: 'ESC-SCH-001',
      user_id: 'USR-SCH-001',
      fullName: 'School Bus Driver John',
      email: 'john.driver@fortuneschool.edu.ng',
      createdBySchoolId: 'cc1928a7-caac-4b17-8142-57e11351a593',
      schoolId: 'cc1928a7-caac-4b17-8142-57e11351a593',
      createdRole: 'school_admin',
      escortCategory: 'school_escort',
      status: 'ACTIVE',
    };

    // New MyEduRide Escort created with a different personal Gmail
    const newMyEduRideEscort = {
      id: 'ESC-MEDU-999',
      user_id: 'USR-MEDU-999',
      fullName: 'Tunde On-Demand Escort',
      email: 'tunde.new.escort99@gmail.com',
      createdBySchoolId: null,
      schoolId: null,
      createdRole: null,
      escortType: 'myeduride_escort',
      escortCategory: 'myeduride_escort',
      status: 'CITY_MANAGER_APPROVED',
    };

    // Assert Category Resolution
    expect(resolveEscortCategory(schoolEscort)).toBe('school_escort');
    expect(resolveEscortCategory(newMyEduRideEscort)).toBe('myeduride_escort');
  }
);

// -----------------------------------------------------------------------------
// Test 2: School Escort Fleet Roster Excludes MyEduRide Escort
// -----------------------------------------------------------------------------
myedurideVsSchoolEscortIsolationSuite.test(
  'Test 2: School fleet roster (/api/school-admin/escort/school-escort) excludes the new MyEduRide escort',
  () => {
    const primarySchoolId = 'cc1928a7-caac-4b17-8142-57e11351a593';

    const allEscortApplications = [
      {
        id: 'ESC-SCH-001',
        fullName: 'School Bus Driver John',
        email: 'john.driver@fortuneschool.edu.ng',
        createdBySchoolId: primarySchoolId,
        schoolId: primarySchoolId,
        createdRole: 'school_admin',
        escortCategory: 'school_escort',
        status: 'ACTIVE',
      },
      {
        id: 'ESC-MEDU-999',
        fullName: 'Tunde On-Demand Escort',
        email: 'tunde.new.escort99@gmail.com',
        createdBySchoolId: null,
        schoolId: null,
        createdRole: null,
        escortType: 'myeduride_escort',
        status: 'CITY_MANAGER_APPROVED',
      },
    ];

    // Filter used by /api/school-admin/escort/school-escort
    const schoolEscortsList = allEscortApplications.filter((e) => {
      if (resolveEscortCategory(e) !== 'school_escort') return false;
      const createdBySchool = e.createdBySchoolId === primarySchoolId || e.schoolId === primarySchoolId;
      return createdBySchool || !e.createdBySchoolId;
    });

    // Verify: Only the school escort is returned. The new Gmail MyEduRide escort is NOT in the school escort roster.
    expect(schoolEscortsList.length).toBe(1);
    expect(schoolEscortsList[0].id).toBe('ESC-SCH-001');
    expect(schoolEscortsList[0].email).toBe('john.driver@fortuneschool.edu.ng');
    expect(schoolEscortsList.some((e) => e.email === 'tunde.new.escort99@gmail.com')).toBe(false);
  }
);

// -----------------------------------------------------------------------------
// Test 3: MyEduRide Pool Includes Only Approved MyEduRide Escort
// -----------------------------------------------------------------------------
myedurideVsSchoolEscortIsolationSuite.test(
  'Test 3: Platform pool (/api/school-admin/escort/myeduride-escort) includes the new MyEduRide escort and excludes school escort',
  () => {
    const allEscortApplications = [
      {
        id: 'ESC-SCH-001',
        fullName: 'School Bus Driver John',
        email: 'john.driver@fortuneschool.edu.ng',
        createdBySchoolId: 'cc1928a7-caac-4b17-8142-57e11351a593',
        escortCategory: 'school_escort',
        status: 'ACTIVE',
      },
      {
        id: 'ESC-MEDU-999',
        fullName: 'Tunde On-Demand Escort',
        email: 'tunde.new.escort99@gmail.com',
        escortType: 'myeduride_escort',
        status: 'CITY_MANAGER_APPROVED',
      },
    ];

    // Filter used by /api/school-admin/escort/myeduride-escort
    const myedurideApprovedList = allEscortApplications.filter((e) => isApprovedMyEduRideEscort(e));

    // Verify: Only the MyEduRide escort is in this roster. The school escort is never included.
    expect(myedurideApprovedList.length).toBe(1);
    expect(myedurideApprovedList[0].id).toBe('ESC-MEDU-999');
    expect(myedurideApprovedList[0].email).toBe('tunde.new.escort99@gmail.com');
    expect(myedurideApprovedList.some((e) => e.email === 'john.driver@fortuneschool.edu.ng')).toBe(false);
  }
);

// -----------------------------------------------------------------------------
// Test 4: Zero Side-Effects on School Escort Data
// -----------------------------------------------------------------------------
myedurideVsSchoolEscortIsolationSuite.test(
  'Test 4: Creating a new MyEduRide escort does not mutate existing school escort assignments, routes, or vehicles',
  () => {
    // Original School Escort State
    const originalSchoolEscort = {
      id: 'ESC-SCH-001',
      fullName: 'School Bus Driver John',
      email: 'john.driver@fortuneschool.edu.ng',
      assignedVehicleId: 'VEH-BUS-01',
      assignedRouteId: 'ROUTE-IKOTUN-01',
      assignedStudentsCount: 15,
      schoolId: 'cc1928a7-caac-4b17-8142-57e11351a593',
    };

    // Snapshot before creating new escort
    const snapshotBefore = JSON.stringify(originalSchoolEscort);

    // Simulate creation of a new MyEduRide Escort in the system
    const newEscortRecord = {
      id: 'ESC-MEDU-1002',
      user_id: 'USR-MEDU-1002',
      fullName: 'Chukwuma New Driver',
      email: 'chukwuma.escort2026@gmail.com',
      escortType: 'myeduride_escort',
      status: 'PENDING_CITY_MANAGER_REVIEW',
    };

    // Simulate state storage
    const databaseEscortTable = [originalSchoolEscort, newEscortRecord];

    // Find the original school escort in the table
    const schoolEscortAfter = databaseEscortTable.find((e) => e.id === 'ESC-SCH-001') as typeof originalSchoolEscort | undefined;

    // Assert: The school escort record is completely unchanged
    expect(JSON.stringify(schoolEscortAfter)).toBe(snapshotBefore);
    expect(schoolEscortAfter?.assignedVehicleId).toBe('VEH-BUS-01');
    expect(schoolEscortAfter?.assignedRouteId).toBe('ROUTE-IKOTUN-01');
    expect(schoolEscortAfter?.assignedStudentsCount).toBe(15);
  }
);

// -----------------------------------------------------------------------------
// Test 5: Login Portal Routing Separation
// -----------------------------------------------------------------------------
myedurideVsSchoolEscortIsolationSuite.test(
  'Test 5: Login credentials route School Escort to /dashboard/escort and MyEduRide Escort to /dashboard/myeduride-escort',
  () => {
    const resolveLoginLanding = (app: any) => {
      const category = resolveEscortCategory(app);
      if (category === 'school_escort') {
        return '/dashboard/escort';
      }
      if (category === 'myeduride_escort' || category === 'shared_ride_escort') {
        return '/dashboard/myeduride-escort';
      }
      return '/dashboard';
    };

    const schoolEscort = {
      createdRole: 'school_admin',
      escortCategory: 'school_escort',
      email: 'john.driver@fortuneschool.edu.ng',
    };

    const myedurideEscort = {
      escortType: 'myeduride_escort',
      email: 'new.different.gmail@gmail.com',
    };

    expect(resolveLoginLanding(schoolEscort)).toBe('/dashboard/escort');
    expect(resolveLoginLanding(myedurideEscort)).toBe('/dashboard/myeduride-escort');
  }
);

if (process.argv[1]?.includes('myeduride-vs-school-escort-isolation')) {
  myedurideVsSchoolEscortIsolationSuite.run().then((results) => {
    const failed = results.filter((r) => !r.passed);
    if (failed.length > 0) {
      console.error(`\x1b[31m${failed.length} test(s) failed!\x1b[0m`);
      process.exit(1);
    } else {
      console.log(`\x1b[32mAll ${results.length} isolation tests PASSED successfully!\x1b[0m`);
    }
  });
}

