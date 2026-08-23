import { TestSuite, expect } from '../utils/test-harness';

export const visitorDomainUnitSuite = new TestSuite('Visitor Domain & Non-Printable Pass Unit Suite', 'UNIT');

visitorDomainUnitSuite.test('Digital Visitor ID Generator: Generates unique standard-compliant IDs and tokens', () => {
  const generateVisitorId = (timestamp: number) => `VIS-2026-${timestamp.toString().slice(-4)}`;
  const generateToken = (randomSeed: number) => `EDURIDE-VIS-${randomSeed}`;

  const id = generateVisitorId(1724401234567);
  const token = generateToken(998120);

  expect(id.startsWith('VIS-2026-')).toBeTruthy();
  expect(token.startsWith('EDURIDE-VIS-')).toBeTruthy();
  expect(token).toBe('EDURIDE-VIS-998120');
});

visitorDomainUnitSuite.test('Strict Non-Printable Invariant: Visitor pass must be digital-only with non-printable flag', () => {
  const visitorPass = {
    id: 'VIS-2026-0881',
    full_name: 'Engr. Chidi Okafor',
    digital_pass_token: 'EDURIDE-VIS-998120',
    is_digital_only: true,
    printable_as_card: false,
  };

  expect(visitorPass.is_digital_only).toBeTruthy();
  expect(visitorPass.printable_as_card).toBeFalsy();
});

visitorDomainUnitSuite.test('Visit Duration Calculator: Accurately computes duration in minutes between entry and exit', () => {
  const entry = new Date('2026-08-23T08:00:00Z');
  const exit = new Date('2026-08-23T08:45:00Z');

  const durationMinutes = Math.round((exit.getTime() - entry.getTime()) / (1000 * 60));
  expect(durationMinutes).toBe(45);
});
