import { TestSuite, expect } from '../utils/test-harness';

export const escortDomainSuite = new TestSuite('Escort Domain Logic & Credential Validation', 'UNIT');

escortDomainSuite.test('School Escort Credential Rules: Validates 11-digit NIN and Driver License', () => {
  const validateNIN = (nin: string) => /^\d{11}$/.test(nin.trim());
  const validateLicense = (license: string) => license.trim().length >= 6;

  expect(validateNIN('29810928412')).toBeTruthy();
  expect(validateNIN('12345')).toBeFalsy();
  expect(validateNIN('29810928412ABC')).toBeFalsy();

  expect(validateLicense('LAG-992381-DL')).toBeTruthy();
  expect(validateLicense('DL-01')).toBeFalsy();
});

escortDomainSuite.test('Domain Boundary: Strict segregation between School Escort and MyEduRide Platform Escort', () => {
  const classifyEscort = (escort: { escortType?: string; createdRole?: string; createdBySchoolId?: string }) => {
    if (escort.escortType === 'school_escort' || escort.createdRole === 'school_admin' || !!escort.createdBySchoolId) {
      return 'SCHOOL_ESCORT';
    }
    return 'MYEDURIDE_ESCORT';
  };

  expect(classifyEscort({ escortType: 'school_escort', createdBySchoolId: 'sch-1' })).toBe('SCHOOL_ESCORT');
  expect(classifyEscort({ createdRole: 'school_admin' })).toBe('SCHOOL_ESCORT');
  expect(classifyEscort({ escortType: 'platform_deputy' })).toBe('MYEDURIDE_ESCORT');
});

escortDomainSuite.test('Performance & Reliability Metrics: On-time rate and rating aggregates', () => {
  const trips = [
    { onTime: true, rating: 5 },
    { onTime: true, rating: 5 },
    { onTime: true, rating: 4 },
    { onTime: false, rating: 4 },
  ];

  const onTimePercentage = (trips.filter((t) => t.onTime).length / trips.length) * 100;
  const avgRating = Number((trips.reduce((acc, t) => acc + t.rating, 0) / trips.length).toFixed(2));

  expect(onTimePercentage).toBe(75);
  expect(avgRating).toBe(4.5);
});
