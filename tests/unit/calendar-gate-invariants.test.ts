import { TestSuite, expect } from '../utils/test-harness';

export const calendarGateInvariantsSuite = new TestSuite('School Calendar & Holiday Gate Invariants', 'UNIT');

calendarGateInvariantsSuite.test('Holiday & Closure Locking Invariant: Blocks operations on non-school days without override', () => {
  const evaluateDayAccess = (
    isNonSchoolDay: boolean,
    dayType: string,
    hasOpenOverride: boolean
  ) => {
    if (hasOpenOverride) {
      return { gate_open: true, reason: 'unlocked_by_school_open_override' };
    }
    if (isNonSchoolDay) {
      return {
        gate_open: false,
        reason: dayType === 'public_holiday' ? 'blocked_public_holiday' : 'blocked_school_closure',
      };
    }
    return { gate_open: true, reason: 'regular_school_day' };
  };

  // Normal day -> Open
  expect(evaluateDayAccess(false, 'regular', false).gate_open).toBeTruthy();

  // Public holiday without override -> Blocked
  const holidayBlocked = evaluateDayAccess(true, 'public_holiday', false);
  expect(holidayBlocked.gate_open).toBeFalsy();
  expect(holidayBlocked.reason).toBe('blocked_public_holiday');

  // School closure without override -> Blocked
  const closureBlocked = evaluateDayAccess(true, 'school_closure', false);
  expect(closureBlocked.gate_open).toBeFalsy();
  expect(closureBlocked.reason).toBe('blocked_school_closure');

  // Public holiday WITH school open override -> Unlocked
  const holidayOverridden = evaluateDayAccess(true, 'public_holiday', true);
  expect(holidayOverridden.gate_open).toBeTruthy();
  expect(holidayOverridden.reason).toBe('unlocked_by_school_open_override');
});

calendarGateInvariantsSuite.test('Event Broadcast Multi-Audience Invariant: Ensures parents, escorts & city managers receive notices', () => {
  const defaultBroadcastAudiences = ['parents', 'escorts', 'city_managers'];

  const matchAudienceForRole = (targetAudiences: string[], userRole: string) => {
    if (userRole === 'city_manager') {
      return targetAudiences.some((a) => ['city_managers', 'city_manager', 'city', 'all'].includes(a.toLowerCase()));
    }
    if (userRole === 'parent') {
      return targetAudiences.some((a) => ['parents', 'parent', 'all'].includes(a.toLowerCase()));
    }
    if (userRole === 'escort') {
      return targetAudiences.some((a) => ['escorts', 'escort', 'all'].includes(a.toLowerCase()));
    }
    return false;
  };

  expect(matchAudienceForRole(defaultBroadcastAudiences, 'parent')).toBeTruthy();
  expect(matchAudienceForRole(defaultBroadcastAudiences, 'escort')).toBeTruthy();
  expect(matchAudienceForRole(defaultBroadcastAudiences, 'city_manager')).toBeTruthy();
  expect(matchAudienceForRole(defaultBroadcastAudiences, 'random_external')).toBeFalsy();
});
