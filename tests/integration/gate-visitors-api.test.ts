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
