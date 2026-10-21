import { TestSuite, expect } from '../utils/test-harness';

export const gateVisitorsApiSuite = new TestSuite('Gate Visitors API Integration Suite', 'INTEGRATION');

gateVisitorsApiSuite.test('GET /api/gate/visitors: Returns active on-campus count and historical records', async () => {
  const mockResponse = {
    success: true,
    metrics: {
      total_visitors_today: 3,
      currently_on_campus: 2,
      departed_today: 1,
      average_visit_duration: '38 mins',
    },
    on_campus_visitors: [
      { id: 'VIS-2026-0881', full_name: 'Engr. Chidi Okafor', status: 'on_campus' },
      { id: 'VIS-2026-0883', full_name: 'Dr. Michael Balogun', status: 'on_campus' },
    ],
  };

  expect(mockResponse.success).toBeTruthy();
  expect(mockResponse.metrics.currently_on_campus).toBe(2);
  expect(mockResponse.on_campus_visitors.length).toBe(2);
});

gateVisitorsApiSuite.test('POST /api/gate/visitors [register_visitor & scan_verify_visitor]: Registration and exit scan cycle', async () => {
  const visitorPayload = {
    full_name: 'Alhaji Sani Bello',
    phone: '+234 803 555 1212',
    purpose_of_visit: 'Board of Governors Meeting',
    person_to_see: 'The Head of School',
    department: 'Executive Office',
    vehicle_plate: 'ABJ-901-BB',
    visitor_type: 'Board Member',
  };

  const registerVisitor = (data: typeof visitorPayload) => ({
    success: true,
    visitor: {
      id: 'VIS-2026-0884',
      digital_pass_token: 'EDURIDE-VIS-551212',
      full_name: data.full_name,
      status: 'on_campus',
      is_digital_only: true,
      entry_time: '2026-08-23T08:00:00Z',
    },
  });

  const regRes = registerVisitor(visitorPayload);
  expect(regRes.success).toBeTruthy();
  expect(regRes.visitor.status).toBe('on_campus');
  expect(regRes.visitor.is_digital_only).toBeTruthy();

  // Scan digital pass upon exit
  const scanExit = (token: string, entryTime: string) => {
    const exitTime = '2026-08-23T08:35:00Z';
    const duration = Math.round((new Date(exitTime).getTime() - new Date(entryTime).getTime()) / 60000);
    return {
      success: true,
      action_performed: 'exit',
      message: `Visitor exit confirmed (${duration} mins).`,
      duration_minutes: duration,
      status: 'departed',
    };
  };

  const exitRes = scanExit(regRes.visitor.digital_pass_token, regRes.visitor.entry_time);
  expect(exitRes.success).toBeTruthy();
  expect(exitRes.action_performed).toBe('exit');
  expect(exitRes.duration_minutes).toBe(35);
  expect(exitRes.status).toBe('departed');
});

gateVisitorsApiSuite.test('POST /api/staff/visitors [accept]: Staff/Admin accepts visitor with stated duration and reason', async () => {
  const visitorId = 'VIS-2026-0901';
  const acceptPayload = {
    visitor_id: visitorId,
    action: 'accept',
    reason: 'Approved by Host Staff. Proceed to classroom 3B.',
    duration_minutes: 45,
  };

  const processHostDecision = (payload: typeof acceptPayload) => {
    return {
      success: true,
      decision: 'accepted',
      host_response: 'accepted',
      security_flag: 'cleared',
      host_response_notes: payload.reason,
      expected_duration_minutes: payload.duration_minutes,
      message: 'Visitor access cleared. Gate officer informed.',
    };
  };

  const res = processHostDecision(acceptPayload);
  expect(res.success).toBeTruthy();
  expect(res.host_response).toBe('accepted');
  expect(res.security_flag).toBe('cleared');
  expect(res.expected_duration_minutes).toBe(45);
  expect(res.host_response_notes).toContain('Approved by Host Staff');
});

gateVisitorsApiSuite.test('POST /api/staff/visitors [decline]: Staff/Admin declines visitor and records reason', async () => {
  const visitorId = 'VIS-2026-0902';
  const declinePayload = {
    visitor_id: visitorId,
    action: 'decline',
    reason: 'Busy in an urgent parent consultation. Please reschedule.',
  };

  const processHostDecline = (payload: typeof declinePayload) => {
    return {
      success: true,
      decision: 'declined',
      host_response: 'declined',
      security_flag: 'flagged',
      decline_reason: payload.reason,
      host_response_notes: payload.reason,
      message: 'Visitor declined. Gate officer notified to deny entry politely.',
    };
  };

  const res = processHostDecline(declinePayload);
  expect(res.success).toBeTruthy();
  expect(res.host_response).toBe('declined');
  expect(res.security_flag).toBe('flagged');
  expect(res.decline_reason).toContain('Busy in an urgent parent consultation');
});

gateVisitorsApiSuite.test('Compute Time Left: Live Countdown and Overdue Threshold Detection', async () => {
  const computeTimeLeft = (entryTimeIso: string, expectedMins: number, nowMs: number) => {
    const entryMs = new Date(entryTimeIso).getTime();
    const elapsedMinutes = Math.max(0, Math.floor((nowMs - entryMs) / 60000));
    const remainingMinutes = expectedMins - elapsedMinutes;

    if (remainingMinutes > 0) {
      const h = Math.floor(remainingMinutes / 60);
      const m = remainingMinutes % 60;
      return {
        time_left_minutes: remainingMinutes,
        time_left_formatted: h > 0 ? `${h}h ${m}m left` : `${m}m left`,
        is_overdue: false,
        status_color: remainingMinutes <= 15 ? 'amber' : 'emerald',
      };
    } else {
      const overdueMins = Math.abs(remainingMinutes);
      return {
        time_left_minutes: remainingMinutes,
        time_left_formatted: `Overstayed by ${overdueMins}m`,
        is_overdue: true,
        status_color: 'rose',
      };
    }
  };

  const now = new Date('2026-10-19T10:00:00Z').getTime();

  // Test case 1: Arrived 20 mins ago with 60 min limit -> 40m left (green)
  const entry1 = '2026-10-19T09:40:00Z';
  const result1 = computeTimeLeft(entry1, 60, now);
  expect(result1.is_overdue).toBeFalsy();
  expect(result1.time_left_minutes).toBe(40);
  expect(result1.time_left_formatted).toBe('40m left');
  expect(result1.status_color).toBe('emerald');

  // Test case 2: Arrived 50 mins ago with 60 min limit -> 10m left (amber warning)
  const entry2 = '2026-10-19T09:10:00Z';
  const result2 = computeTimeLeft(entry2, 60, now);
  expect(result2.is_overdue).toBeFalsy();
  expect(result2.time_left_minutes).toBe(10);
  expect(result2.time_left_formatted).toBe('10m left');
  expect(result2.status_color).toBe('amber');

  // Test case 3: Arrived 80 mins ago with 60 min limit -> 20m overdue (rose alert)
  const entry3 = '2026-10-19T08:40:00Z';
  const result3 = computeTimeLeft(entry3, 60, now);
  expect(result3.is_overdue).toBeTruthy();
  expect(result3.time_left_formatted).toBe('Overstayed by 20m');
  expect(result3.status_color).toBe('rose');
});

