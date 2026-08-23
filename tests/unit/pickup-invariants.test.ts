import { TestSuite, expect } from '../utils/test-harness';

export const pickupInvariantsSuite = new TestSuite('Pickup List Business Invariants & Invariants Engine', 'UNIT');

pickupInvariantsSuite.test('City Manager Approval Invariant: Unapproved platform escorts must be barred', () => {
  const approvedStatuses = new Set(['CITY_MANAGER_APPROVED', 'ACTIVE', 'ACTIVATED']);
  
  const mockEscorts = [
    { id: '1', name: 'John Doe', status: 'CITY_MANAGER_APPROVED', escortType: 'platform' },
    { id: '2', name: 'Jane Smith', status: 'PENDING_CITY_MANAGER_REVIEW', escortType: 'platform' },
    { id: '3', name: 'Alice Brown', status: 'REJECTED', escortType: 'platform' },
    { id: '4', name: 'Bob White', status: 'ACTIVE', escortType: 'platform' },
  ];

  const filteredForPickup = mockEscorts.filter((e) => approvedStatuses.has(e.status));
  
  expect(filteredForPickup.length).toBe(2);
  expect(filteredForPickup.map((e) => e.name)).toEqual(['John Doe', 'Bob White']);
  expect(filteredForPickup.some((e) => e.name === 'Jane Smith')).toBeFalsy();
});

pickupInvariantsSuite.test('4-Mode Assignment Validation: Rejects invalid or unpermitted pickup modes', () => {
  const allowedModes = ['escort', 'parent', 'sibling', 'walk_home'];
  
  const isValidMode = (mode: string) => allowedModes.includes(mode);
  
  expect(isValidMode('escort')).toBeTruthy();
  expect(isValidMode('parent')).toBeTruthy();
  expect(isValidMode('sibling')).toBeTruthy();
  expect(isValidMode('walk_home')).toBeTruthy();
  expect(isValidMode('unregistered_stranger')).toBeFalsy();
  expect(isValidMode('unknown_mode')).toBeFalsy();
});

pickupInvariantsSuite.test('Sibling Link Resolver: Correctly identifies siblings by shared parent or explicit relationship', () => {
  const students = [
    { id: 'STU-1', name: 'Stephanie Mba', parentId: 'PAR-101' },
    { id: 'STU-2', name: 'David Mba', parentId: 'PAR-101' },
    { id: 'STU-3', name: 'Daniel Peter', parentId: 'PAR-202' },
  ];

  const explicitPickupPersons = [
    { studentId: 'STU-3', name: 'Victor Peter', relationship: 'Older Brother (Sibling)' },
  ];

  const findSiblings = (studentId: string) => {
    const current = students.find((s) => s.id === studentId);
    if (!current) return [];
    
    // Method 1: Shared parent
    const sharedParentSiblings = students
      .filter((s) => s.parentId === current.parentId && s.id !== studentId)
      .map((s) => ({ name: s.name, type: 'family_enrolled' }));
    
    // Method 2: Explicit pickup person
    const explicitSiblings = explicitPickupPersons
      .filter((p) => p.studentId === studentId && (p.relationship.toLowerCase().includes('sibling') || p.relationship.toLowerCase().includes('brother')))
      .map((p) => ({ name: p.name, type: 'explicit_pickup_person' }));

    return [...sharedParentSiblings, ...explicitSiblings];
  };

  const stephanieSiblings = findSiblings('STU-1');
  expect(stephanieSiblings.length).toBe(1);
  expect(stephanieSiblings[0].name).toBe('David Mba');

  const danielSiblings = findSiblings('STU-3');
  expect(danielSiblings.length).toBe(1);
  expect(danielSiblings[0].name).toBe('Victor Peter');
});

pickupInvariantsSuite.test('Walk-Home Safety Consent: Prevents walk home release without verified authorization', () => {
  const studentRecords = [
    { id: 'STU-1', name: 'Tunde', walkHomePermitted: true, notes: 'Parent waiver signed' },
    { id: 'STU-2', name: 'Amaka', walkHomePermitted: false, notes: '' },
  ];

  const canWalkHome = (studentId: string) => {
    const student = studentRecords.find((s) => s.id === studentId);
    return !!student?.walkHomePermitted;
  };

  expect(canWalkHome('STU-1')).toBeTruthy();
  expect(canWalkHome('STU-2')).toBeFalsy();
});
