import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAuthorizedSchoolAdmin } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { todayInLagos, formatDateTimeLagos, formatDateLagos } from '@/lib/timezone';
import { lagosDayBoundsFromDateStr, timestampToLagosDateKey } from '@/lib/attendance/lagos-dates';

export const dynamic = 'force-dynamic';

/**
 * GET /api/school-admin/reports/student-registrations
 * Daily / date-range student creation counts for accountants.
 *
 * Query:
 *  - school_id (optional)
 *  - date=YYYY-MM-DD (single Lagos day; default today)
 *  - from=YYYY-MM-DD & to=YYYY-MM-DD (range; overrides date)
 *  - format=csv (optional download)
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId =
      searchParams.get('school_id')?.trim() ||
      (session as any).primary_school?.id ||
      session.roles?.find((r: any) => r.role === 'school_admin' && r.school_id)?.school_id ||
      session.roles?.find((r: any) => r.school_id)?.school_id ||
      null;

    if (!schoolId) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }

    if (!isAuthorizedSchoolAdmin(session, schoolId)) {
      return NextResponse.json({ error: 'School admin access required' }, { status: 403 });
    }

    const today = todayInLagos();
    const fromParam = searchParams.get('from')?.trim();
    const toParam = searchParams.get('to')?.trim();
    const dateParam = searchParams.get('date')?.trim() || today;
    const format = (searchParams.get('format') || 'json').toLowerCase();

    let rangeStart: string;
    let rangeEnd: string;
    let mode: 'day' | 'range' = 'day';

    if (fromParam && toParam) {
      mode = 'range';
      rangeStart = lagosDayBoundsFromDateStr(fromParam).startIso;
      rangeEnd = lagosDayBoundsFromDateStr(toParam).endIso;
    } else {
      const bounds = lagosDayBoundsFromDateStr(dateParam);
      rangeStart = bounds.startIso;
      rangeEnd = bounds.endIso;
    }

    const supabase = getAdminClient();
    const { data: rows, error } = await supabase
      .from('students')
      .select(
        'id, first_name, last_name, student_id_number, photo_url, is_active, created_at, class_id, class:school_classes(id, name, grade, section)'
      )
      .eq('school_id', schoolId)
      .gte('created_at', rangeStart)
      .lte('created_at', rangeEnd)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const students = (rows || []).map((s: any) => ({
      id: s.id,
      first_name: s.first_name,
      last_name: s.last_name,
      full_name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
      student_id_number: s.student_id_number,
      class_name: Array.isArray(s.class) ? s.class[0]?.name : s.class?.name || '—',
      is_active: s.is_active,
      created_at: s.created_at,
      created_at_display: formatDateTimeLagos(s.created_at),
      registration_date: s.created_at ? timestampToLagosDateKey(s.created_at) : null,
    }));

    // Group counts by Lagos calendar day (for range / accountant summary)
    const byDayMap = new Map<string, number>();
    for (const s of students) {
      if (!s.registration_date) continue;
      byDayMap.set(s.registration_date, (byDayMap.get(s.registration_date) || 0) + 1);
    }
    const by_day = Array.from(byDayMap.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, count]) => ({ date, count, date_display: formatDateLagos(`${date}T12:00:00+01:00`) }));

    if (format === 'csv') {
      const header = ['Registration Date', 'Registration Time', 'Student Name', 'Student ID', 'Class', 'Active'];
      const lines = [
        header.join(','),
        ...students.map((s) =>
          [
            s.registration_date || '',
            s.created_at_display || '',
            `"${String(s.full_name).replace(/"/g, '""')}"`,
            s.student_id_number || '',
            `"${String(s.class_name).replace(/"/g, '""')}"`,
            s.is_active ? 'Yes' : 'No',
          ].join(',')
        ),
      ];
      return new NextResponse(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="student-registrations-${dateParam || 'range'}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      school_id: schoolId,
      mode,
      date: mode === 'day' ? dateParam : null,
      from: fromParam || (mode === 'day' ? dateParam : null),
      to: toParam || (mode === 'day' ? dateParam : null),
      total_registered: students.length,
      by_day,
      students,
    });
  } catch (err: any) {
    console.error('[student-registrations]', err);
    return NextResponse.json({ error: err.message || 'Failed to load registrations' }, { status: 500 });
  }
}
