import { TestSuite, expect } from '../utils/test-harness';

export const visitorsReportSuite = new TestSuite(
  'School Admin Visitors Report & Decision Engine Suite',
  'UNIT'
);

// 1. Invariant: Visitor Ledger Status and Search Filtering
visitorsReportSuite.test('Invariant 1: Visitors ledger filters accurately by status and search queries', () => {
  const sampleVisitors = [
    {
      id: 'VIS-001',
      full_name: 'Dr. Chuka Obi',
      phone: '+234 803 111 2233',
      purpose_of_visit: 'Ministry Curriculum Inspection',
      person_to_see: 'Principal',
      department: 'Executive Administration',
      status: 'on_campus',
      host_response: 'accepted',
      entry_time: '2026-09-11T09:00:00.000Z',
      exit_time: null,
    },
    {
      id: 'VIS-002',
      full_name: 'Mrs. Folashade Adeleke',
      phone: '+234 802 333 4455',
      purpose_of_visit: 'Parent Inquiry Regarding Bus Route',
      person_to_see: 'Transport Manager',
      department: 'Logistics',
      status: 'departed',
      host_response: 'accepted',
      entry_time: '2026-09-11T10:15:00.000Z',
      exit_time: '2026-09-11T11:00:00.000Z',
    },
    {
      id: 'VIS-003',
      full_name: 'Mr. Jude Alabi (Vendor)',
      phone: '+234 809 555 6677',
      purpose_of_visit: 'Laboratory Equipment Quotation',
      person_to_see: 'School Admin',
      department: 'Procurement',
      status: 'on_campus',
      host_response: 'pending',
      entry_time: '2026-09-11T11:30:00.000Z',
      exit_time: null,
    },
    {
      id: 'VIS-004',
      full_name: 'Unsolicited Solicitor',
      phone: '+234 814 777 8899',
      purpose_of_visit: 'Cold Sales Pitch',
      person_to_see: 'School Admin',
      department: 'Administration',
      status: 'departed',
      host_response: 'declined',
      entry_time: '2026-09-11T12:00:00.000Z',
      exit_time: '2026-09-11T12:05:00.000Z',
    },
  ];

  // Test status filtering
  const onCampus = sampleVisitors.filter((v) => v.status === 'on_campus');
  expect(onCampus.length).toBe(2);

  const pendingApproval = sampleVisitors.filter((v) => v.host_response === 'pending');
  expect(pendingApproval.length).toBe(1);
  expect(pendingApproval[0].id).toBe('VIS-003');

  const declined = sampleVisitors.filter((v) => v.host_response === 'declined');
  expect(declined.length).toBe(1);
  expect(declined[0].id).toBe('VIS-004');

  // Test search filtering
  const searchFilter = (query: string, list: typeof sampleVisitors) => {
    const q = query.toLowerCase();
    return list.filter(
      (v) =>
        v.full_name.toLowerCase().includes(q) ||
        v.purpose_of_visit.toLowerCase().includes(q) ||
        v.person_to_see.toLowerCase().includes(q)
    );
  };

  const inspectionSearch = searchFilter('curriculum', sampleVisitors);
  expect(inspectionSearch.length).toBe(1);
  expect(inspectionSearch[0].id).toBe('VIS-001');

  const vendorSearch = searchFilter('vendor', sampleVisitors);
  expect(vendorSearch.length).toBe(1);
  expect(vendorSearch[0].id).toBe('VIS-003');
});

// 2. Invariant: Admin Accept & Decline State Transitions
visitorsReportSuite.test('Invariant 2: Admin Accept/Decline action transitions visitor state and attaches gate reason', () => {
  const applyAdminDecision = (
    visitor: {
      id: string;
      full_name: string;
      host_response: string;
      security_flag: string;
      host_response_notes?: string | null;
      host_response_at?: string | null;
    },
    action: 'accept' | 'decline',
    reason?: string
  ) => {
    const isAccept = action === 'accept';
    return {
      ...visitor,
      host_response: isAccept ? 'accepted' : 'declined',
      security_flag: isAccept ? 'cleared' : 'flagged',
      host_response_notes: reason || (isAccept ? 'Approved by Admin' : 'Admin busy / not around'),
      host_response_at: new Date().toISOString(),
    };
  };

  const initialVisitor = {
    id: 'VIS-999',
    full_name: 'Mr. Babajide Peters',
    host_response: 'pending',
    security_flag: 'restricted',
    host_response_notes: null,
    host_response_at: null,
  };

  // Case A: Admin Accepts
  const acceptedVisitor = applyAdminDecision(initialVisitor, 'accept', 'Approved: Send to Principal Office');
  expect(acceptedVisitor.host_response).toBe('accepted');
  expect(acceptedVisitor.security_flag).toBe('cleared');
  expect(acceptedVisitor.host_response_notes).toBe('Approved: Send to Principal Office');
  expect(Boolean(acceptedVisitor.host_response_at)).toBe(true);

  // Case B: Admin Declines due to meeting
  const declinedVisitor = applyAdminDecision(
    initialVisitor,
    'decline',
    'Busy in an urgent meeting / Cannot attend right now'
  );
  expect(declinedVisitor.host_response).toBe('declined');
  expect(declinedVisitor.security_flag).toBe('flagged');
  expect(declinedVisitor.host_response_notes).toContain('Busy in an urgent meeting');

  // Case C: Admin Declines due to not being around
  const notAroundVisitor = applyAdminDecision(
    initialVisitor,
    'decline',
    'Not around / Out of campus today'
  );
  expect(notAroundVisitor.host_response).toBe('declined');
  expect(notAroundVisitor.host_response_notes).toContain('Not around');
});

// 3. Invariant: Visit Duration Calculation & Human Formatting
visitorsReportSuite.test('Invariant 3: Visit duration is correctly computed for completed and on-campus visits', () => {
  const computeDurationMins = (entryTime: string, exitTime?: string | null, referenceNowMs?: number) => {
    const entryMs = new Date(entryTime).getTime();
    const exitMs = exitTime ? new Date(exitTime).getTime() : (referenceNowMs || Date.now());
    return Math.max(1, Math.round((exitMs - entryMs) / 60000));
  };

  const formatDurationStr = (mins: number) => {
    if (mins < 60) return `${mins} mins`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  // 45-minute visit
  const entry = '2026-09-11T10:00:00.000Z';
  const exit45 = '2026-09-11T10:45:00.000Z';
  const mins45 = computeDurationMins(entry, exit45);
  expect(mins45).toBe(45);
  expect(formatDurationStr(mins45)).toBe('45 mins');

  // 1 hour 20-minute visit
  const exit80 = '2026-09-11T11:20:00.000Z';
  const mins80 = computeDurationMins(entry, exit80);
  expect(mins80).toBe(80);
  expect(formatDurationStr(mins80)).toBe('1h 20m');

  // Ongoing on-campus visit (mocked now = +30 mins)
  const nowMock = new Date('2026-09-11T10:30:00.000Z').getTime();
  const minsOngoing = computeDurationMins(entry, null, nowMock);
  expect(minsOngoing).toBe(30);
  expect(formatDurationStr(minsOngoing)).toBe('30 mins');
});

// 4. Invariant: CSV Header and Content Structure
visitorsReportSuite.test('Invariant 4: CSV export builds valid headers and escaped values', () => {
  const escapeCsvCell = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headers = [
    'Visitor Pass Token',
    'Visitor Name',
    'Phone Number',
    'Visitor Type',
    'Purpose of Visit',
    'Person to See',
    'Time of Entry',
    'Time of Exit',
    'Duration on Campus',
    'Admin Decision',
    'Action Taken',
  ];

  const row = [
    'EDURIDE-VIS-102938',
    'Alhaji Musa Dangote',
    '+234 803 999 1122',
    'Parent / Guardian',
    'Fees payment, bursary check',
    'Bursar',
    '09:30 AM',
    '10:15 AM',
    '45 mins',
    'ACCEPTED',
    'Approved by Admin',
  ];

  const csvLine = row.map(escapeCsvCell).join(',');
  expect(csvLine).toContain('"EDURIDE-VIS-102938"');
  expect(csvLine).toContain('"Fees payment, bursary check"'); // Must preserve commas inside quotes
  expect(csvLine).toContain('"ACCEPTED"');

  const headerLine = headers.map(escapeCsvCell).join(',');
  expect(headerLine).toContain('"Visitor Pass Token"');
  expect(headerLine).toContain('"Purpose of Visit"');
  expect(headerLine).toContain('"Time of Exit"');
});
