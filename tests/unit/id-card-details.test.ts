import { resolveStudentIdCardDetails } from '@/lib/id-card/resolve-student-details';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

console.log('--- RUNNING ID CARD DETAILS TESTS ---');

// Test 1: Prioritize linked primary parent from database
{
  const student = {
    id: 'stu-1',
    first_name: 'Ademide',
    last_name: 'Adebayo',
    house_address: null,
    house_landmark: null,
    custom_fields: {
      address: '6 abeokuta street,off idimu road,idimu lagos.',
      parent_name: 'Old Parent Name',
      parent_phone: '',
    },
  };
  const parents = [
    {
      student_id: 'stu-1',
      is_primary: true,
      relationship: 'parent',
      parent: {
        id: 'user-1',
        full_name: 'Mr and Mrs Adebayo',
        phone: '08012345678',
      },
    },
  ];

  const resolved = resolveStudentIdCardDetails(student, parents, null);
  assert(resolved.guardianName === 'Mr and Mrs Adebayo', `Expected guardian name to be 'Mr and Mrs Adebayo', got '${resolved.guardianName}'`);
  assert(resolved.guardianPhone === '08012345678', `Expected guardian phone to be '08012345678', got '${resolved.guardianPhone}'`);
  assert(resolved.homeStop === '6 abeokuta street,off idimu road,idimu lagos.', `Expected home stop from address, got '${resolved.homeStop}'`);
  console.log('✓ Test 1 Passed: Primary linked parent priority');
}

// Test 2: Transport route assignment priority for home stop
{
  const student = {
    id: 'stu-2',
    first_name: 'Zoe',
    last_name: 'Osaghae',
    house_address: '6, Aina street',
    house_landmark: 'Orisumbare bus stop',
    custom_fields: {},
  };
  const routeAssignment = {
    student_id: 'stu-2',
    morning_stop: {
      name: 'Corridor 4 Stop B',
      landmark: 'Near Central Mosque',
    },
    morning_route: {
      route_code: 'RT-NORTH-01',
    },
  };

  const resolved = resolveStudentIdCardDetails(student, null, routeAssignment);
  assert(resolved.homeStop === 'Corridor 4 Stop B (Near Central Mosque)', `Expected route stop with landmark, got '${resolved.homeStop}'`);
  assert(resolved.routeCode === 'RT-NORTH-01', `Expected route code RT-NORTH-01, got '${resolved.routeCode}'`);
  console.log('✓ Test 2 Passed: Route stop and code priority');
}

// Test 3: Fallback handling without fake strings (no fake Mrs. Ngozi Okafor)
{
  const emptyStudent = {
    id: 'stu-3',
    first_name: 'John',
    last_name: 'Doe',
  };

  const resolved = resolveStudentIdCardDetails(emptyStudent, null, null);
  assert(resolved.guardianName === 'Not Assigned', `Expected 'Not Assigned', got '${resolved.guardianName}'`);
  assert(resolved.guardianPhone === 'Not Available', `Expected 'Not Available', got '${resolved.guardianPhone}'`);
  assert(resolved.homeStop === 'Campus Gate', `Expected 'Campus Gate', got '${resolved.homeStop}'`);
  assert(resolved.routeCode === 'R-CAMPUS', `Expected 'R-CAMPUS', got '${resolved.routeCode}'`);
  console.log('✓ Test 3 Passed: Honest clean fallbacks');
}

// Test 4: Database route code column ('code'), array shapes, and afternoon route fallback
{
  // 4a. Database column 'code' on morning_route
  const resCode = resolveStudentIdCardDetails(
    { id: 'stu-4' },
    null,
    {
      student_id: 'stu-4',
      morning_route: { id: 'rt-1', name: 'Ejigbo Express', code: 'EJG-01' },
    }
  );
  assert(resCode.routeCode === 'EJG-01', `Expected 'EJG-01', got '${resCode.routeCode}'`);

  // 4b. PostgREST array response shape
  const resArray = resolveStudentIdCardDetails(
    { id: 'stu-5' },
    null,
    {
      student_id: 'stu-5',
      morning_route: [{ id: 'rt-2', name: 'Iyana Ipaja Loop', code: 'IYP-02' }],
    }
  );
  assert(resArray.routeCode === 'IYP-02', `Expected 'IYP-02', got '${resArray.routeCode}'`);

  // 4c. Afternoon route fallback when morning route is absent
  const resAfternoon = resolveStudentIdCardDetails(
    { id: 'stu-6' },
    null,
    {
      student_id: 'stu-6',
      morning_route: null,
      afternoon_route: { id: 'rt-3', name: 'Victoria Island Return', code: 'VI-03' },
    }
  );
  assert(resAfternoon.routeCode === 'VI-03', `Expected 'VI-03', got '${resAfternoon.routeCode}'`);

  // 4d. Custom fields route fallback
  const resCustom = resolveStudentIdCardDetails(
    { id: 'stu-7', custom_fields: { route_code: 'SCH-BUS-9' } },
    null,
    null
  );
  assert(resCustom.routeCode === 'SCH-BUS-9', `Expected 'SCH-BUS-9', got '${resCustom.routeCode}'`);
  console.log('✓ Test 4 Passed: Database transport_routes.code and array shapes');
}

console.log('--- ALL ID CARD DETAILS TESTS PASSED ---');

