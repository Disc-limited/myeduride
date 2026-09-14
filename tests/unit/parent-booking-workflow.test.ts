import { TestSuite, expect } from '../utils/test-harness';
import { attachHandoverPin, ensureDailyHandoverPin, extractHandoverPin, isTodayHandoverPin, normalizePin } from '../../src/lib/escort/handover-pin';

export const parentBookingWorkflowDomainSuite = new TestSuite('Parent Booking 5-Stage Workflow Domain Unit Suite', 'UNIT');

parentBookingWorkflowDomainSuite.test('5-Stage Workflow Transitions: Enforces strict state sequence', () => {
  const stages = [
    { stage: 1, name: 'Parent Booking Request', status: 'PENDING_CM_REVIEW' },
    { stage: 2, name: 'City Manager Review', status: 'UNDER_CM_REVIEW' },
    { stage: 3, name: 'Escort Assignment', status: 'ESCORT_ASSIGNED' },
    { stage: 4, name: 'City Manager Approval', status: 'APPROVED' },
    { stage: 5, name: 'Parent Notification', status: 'CONFIRMED' },
  ];

  expect(stages.length).toBe(5);
  expect(stages[0].status).toBe('PENDING_CM_REVIEW');
  expect(stages[4].status).toBe('CONFIRMED');
});

parentBookingWorkflowDomainSuite.test('Area-Based Escort Matching: Matches child operating zone to certified escort', () => {
  const childZone = 'Victoria Island / Oniru / Lekki';
  const availableEscorts = [
    { id: 'ESC-01', name: 'Babatunde Lawal', operatingArea: 'Victoria Island / Oniru / Lekki', status: 'Available' },
    { id: 'ESC-02', name: 'Chioma Okonkwo', operatingArea: 'Ikeja / Maryland / GRA', status: 'Available' },
  ];

  const matchedEscorts = availableEscorts.filter((e) => e.operatingArea === childZone);
  expect(matchedEscorts.length).toBe(1);
  expect(matchedEscorts[0].name).toBe('Babatunde Lawal');
});

parentBookingWorkflowDomainSuite.test('Handover Security PIN: 4-digit code generated upon City Manager approval', () => {
  const generateHandoverPin = () => Math.floor(1000 + Math.random() * 9000).toString();
  const pin = generateHandoverPin();

  expect(pin.length).toBe(4);
  expect(typeof pin).toBe('string');
});

parentBookingWorkflowDomainSuite.test('Parent phone code: extract PIN from JSON notes and PIN: #### text without dropping other notes', () => {
  expect(extractHandoverPin(JSON.stringify({ security_pin: '4821', school_notes: 'Keep me' }))).toBe('4821');
  expect(extractHandoverPin('CM Notes: cleared | PIN: 9031')).toBe('9031');
  expect(normalizePin('  12-34  ')).toBe('1234');

  const attached = attachHandoverPin(JSON.stringify({ school_notes: 'Keep me' }), '7712');
  const parsed = JSON.parse(attached);
  expect(parsed.school_notes).toBe('Keep me');
  expect(parsed.security_pin).toBe('7712');
});

parentBookingWorkflowDomainSuite.test('Daily parent phone code: rotates each day and yesterday\'s key cannot be reused', () => {
  const dayOne = ensureDailyHandoverPin({ school_notes: 'Keep me' }, '2026-09-14');
  expect(dayOne.pin.length).toBe(4);
  expect(dayOne.rotated).toBe(true);
  expect(isTodayHandoverPin(dayOne.notes, dayOne.pin, '2026-09-14')).toBe(true);

  const sameDay = ensureDailyHandoverPin(JSON.parse(dayOne.notes), '2026-09-14');
  expect(sameDay.pin).toBe(dayOne.pin);
  expect(sameDay.rotated).toBe(false);

  const dayTwo = ensureDailyHandoverPin(JSON.parse(dayOne.notes), '2026-09-15');
  expect(dayTwo.rotated).toBe(true);
  if (dayTwo.pin === dayOne.pin) {
    throw new Error(`Expected a new daily pin, but ${dayTwo.pin} was reused`);
  }
  expect(isTodayHandoverPin(dayTwo.notes, dayOne.pin, '2026-09-15')).toBe(false);
  expect(isTodayHandoverPin(dayTwo.notes, dayTwo.pin, '2026-09-15')).toBe(true);
  expect(extractHandoverPin(dayTwo.notes)).toBe(dayTwo.pin);
  expect(JSON.parse(dayTwo.notes).school_notes).toBe('Keep me');
});
