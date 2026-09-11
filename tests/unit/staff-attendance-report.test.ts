import { TestSuite, expect } from '../utils/test-harness';

export const staffAttendanceReportSuite = new TestSuite(
  'School Admin Staff Attendance Report & Database Synchronization Suite',
  'UNIT'
);

// 1. Invariant: Staff status categorization based on late threshold
staffAttendanceReportSuite.test('Invariant 1: Staff status correctly categorized as present, late, or absent against late threshold', () => {
  const staffStatusFromClockIn = (clockInIso: string | null, lateThreshold = '08:15') => {
    if (!clockInIso) {
      return { status: 'absent' as const, minutes_late: null };
    }

    // Extract HH:MM from ISO string
    const timeMatch = clockInIso.match(/T(\d{2}):(\d{2})/);
    if (!timeMatch) return { status: 'present' as const, minutes_late: null };

    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    const clockInMinutes = hour * 60 + minute;

    const [tHour, tMinute] = lateThreshold.split(':').map((v) => parseInt(v, 10));
    const thresholdMinutes = tHour * 60 + tMinute;

    if (clockInMinutes > thresholdMinutes) {
      return {
        status: 'late' as const,
        minutes_late: clockInMinutes - thresholdMinutes,
      };
    }

    return {
      status: 'present' as const,
      minutes_late: null,
    };
  };

  // Clock in at 07:45 AM (before 08:15) -> Present / On time
  const onTime = staffStatusFromClockIn('2026-09-11T07:45:00Z', '08:15');
  expect(onTime.status).toBe('present');
  expect(onTime.minutes_late).toBe(null);

  // Clock in at 08:30 AM (15 mins late) -> Late
  const late = staffStatusFromClockIn('2026-09-11T08:30:00Z', '08:15');
  expect(late.status).toBe('late');
  expect(late.minutes_late).toBe(15);

  // No clock in -> Absent
  const absent = staffStatusFromClockIn(null, '08:15');
  expect(absent.status).toBe('absent');
  expect(absent.minutes_late).toBe(null);
});

// 2. Invariant: Staff Attendance Aggregations
staffAttendanceReportSuite.test('Invariant 2: Summary statistics accurately aggregate total, present, late, and absent staff', () => {
  const staffRows = [
    { user_id: 'U-1', full_name: 'Mr. John Okafor', role: 'teacher', status: 'present', clock_in_time: '2026-09-11T07:50:00Z' },
    { user_id: 'U-2', full_name: 'Mrs. Fatima Bello', role: 'teacher', status: 'late', clock_in_time: '2026-09-11T08:25:00Z', minutes_late: 10 },
    { user_id: 'U-3', full_name: 'Mr. Emmanuel Ade', role: 'gate_officer', status: 'present', clock_in_time: '2026-09-11T06:30:00Z' },
    { user_id: 'U-4', full_name: 'Ms. Grace Danladi', role: 'staff', status: 'absent', clock_in_time: null },
  ];

  const computeSummary = (rows: typeof staffRows) => {
    return {
      total: rows.length,
      present: rows.filter((r) => r.status === 'present').length,
      late: rows.filter((r) => r.status === 'late').length,
      absent: rows.filter((r) => r.status === 'absent').length,
      attendance_pct: rows.length > 0
        ? Math.round(((rows.filter((r) => r.status === 'present' || r.status === 'late').length) / rows.length) * 100)
        : 0,
    };
  };

  const summary = computeSummary(staffRows);
  expect(summary.total).toBe(4);
  expect(summary.present).toBe(2);
  expect(summary.late).toBe(1);
  expect(summary.absent).toBe(1);
  expect(summary.attendance_pct).toBe(75); // (2 on time + 1 late) / 4 = 75%
});

// 3. Invariant: Staff role and search filtering
staffAttendanceReportSuite.test('Invariant 3: Staff report correctly filters by role category and search query', () => {
  const staffRows = [
    { user_id: 'U-1', full_name: 'Adebayo Ogunlesi', role: 'Mathematics Teacher' },
    { user_id: 'U-2', full_name: 'Ngozi Eze', role: 'Science Teacher' },
    { user_id: 'U-3', full_name: 'Musa Garba', role: 'Head Gate Officer' },
    { user_id: 'U-4', full_name: 'Chukwuma Obi', role: 'Bursar / Administrative Staff' },
  ];

  const filterStaff = (rows: typeof staffRows, roleFilter: string, searchQuery: string) => {
    return rows.filter((r) => {
      const matchRole = !roleFilter || r.role.toLowerCase().includes(roleFilter.toLowerCase());
      const matchSearch = !searchQuery || r.full_name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchRole && matchSearch;
    });
  };

  // Filter by Teacher
  const teachers = filterStaff(staffRows, 'teacher', '');
  expect(teachers.length).toBe(2);
  expect(teachers.every((t) => t.role.toLowerCase().includes('teacher'))).toBe(true);

  // Filter by Gate Officer
  const gateOfficers = filterStaff(staffRows, 'gate', '');
  expect(gateOfficers.length).toBe(1);
  expect(gateOfficers[0].full_name).toBe('Musa Garba');

  // Search by name
  const searched = filterStaff(staffRows, '', 'ngozi');
  expect(searched.length).toBe(1);
  expect(searched[0].full_name).toBe('Ngozi Eze');
});

// 4. Invariant: CSV Export structure for staff attendance
staffAttendanceReportSuite.test('Invariant 4: Staff CSV rows format includes entity, timestamps, and late minutes', () => {
  const staffReport = [
    {
      full_name: 'Adebayo Ogunlesi',
      role: 'teacher',
      status: 'late',
      clock_in_time: '2026-09-11T08:25:00Z',
      clock_out_time: '2026-09-11T16:00:00Z',
      minutes_late: 10,
    },
  ];

  const csvRows = staffReport.map((s) => ({
    entity: 'staff',
    name: s.full_name,
    role: s.role,
    status: s.status,
    sign_in: s.clock_in_time || '',
    sign_out: s.clock_out_time || '',
    minutes_late: s.minutes_late ?? '',
  }));

  expect(csvRows[0].entity).toBe('staff');
  expect(csvRows[0].name).toBe('Adebayo Ogunlesi');
  expect(csvRows[0].role).toBe('teacher');
  expect(csvRows[0].status).toBe('late');
  expect(csvRows[0].minutes_late).toBe(10);
});
