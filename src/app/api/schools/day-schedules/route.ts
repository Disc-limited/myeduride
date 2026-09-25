import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME_FIELDS = [
  'gate_open_time',
  'school_start_time',
  'late_threshold',
  'gate_close_time',
  'dismissal_start_time',
  'dismissal_end_time',
  'student_gate_start',
  'student_gate_end',
  'staff_gate_start',
  'staff_gate_end',
] as const;

type TimeField = (typeof TIME_FIELDS)[number];

function isSchoolAdmin(session: ReturnType<typeof getSessionFromRequest>, schoolId: string): boolean {
  if (!session) return false;
  if (sessionHasRole(session, 'super_admin')) return true;
  return session.roles.some(
    (r) => r.school_id === schoolId && ['school_admin'].includes(r.role)
  );
}

// ─── GET /api/schools/day-schedules?school_id=<id> ────────────────────────────
// Returns all active day-of-week schedule overrides for a school.
// Each entry includes day_name for display convenience.
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const schoolId = request.nextUrl.searchParams.get('school_id');
    if (!schoolId) return NextResponse.json({ error: 'school_id required' }, { status: 400 });

    if (!isSchoolAdmin(session, schoolId)) {
      return NextResponse.json({ error: 'School admin access required' }, { status: 403 });
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('school_day_schedules')
      .select('*')
      .eq('school_id', schoolId)
      .order('day_of_week', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const enriched = (data || []).map((row) => ({
      ...row,
      day_name: DAY_NAMES[row.day_of_week] ?? `Day ${row.day_of_week}`,
    }));

    return NextResponse.json({ schedules: enriched });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to load day schedules';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── PUT /api/schools/day-schedules ──────────────────────────────────────────
// Upsert a day-of-week schedule override.
// Body: { school_id, day_of_week, dismissal_start_time, ..., is_active, notes }
export async function PUT(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { school_id, day_of_week, is_active, notes } = body;

    if (!school_id) return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    if (day_of_week === undefined || day_of_week === null || day_of_week < 0 || day_of_week > 6) {
      return NextResponse.json({ error: 'day_of_week must be 0–6' }, { status: 400 });
    }

    if (!isSchoolAdmin(session, school_id)) {
      return NextResponse.json({ error: 'School admin access required' }, { status: 403 });
    }

    const supabase = getAdminClient();

    // Build the payload — only include time fields that were explicitly provided
    const payload: Record<string, unknown> = {
      school_id,
      day_of_week,
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      notes: notes ?? null,
      updated_at: new Date().toISOString(),
    };

    for (const field of TIME_FIELDS) {
      if (field in body) {
        const val = body[field as string];
        // Accept null (to clear) or 'HH:MM' string
        payload[field] = val ? String(val).slice(0, 5) : null;
      }
    }

    const { data, error } = await supabase
      .from('school_day_schedules')
      .upsert(payload, { onConflict: 'school_id,day_of_week' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      schedule: { ...data, day_name: DAY_NAMES[data.day_of_week] ?? `Day ${data.day_of_week}` },
      message: `${DAY_NAMES[day_of_week]} schedule saved successfully`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save day schedule';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── DELETE /api/schools/day-schedules?school_id=<id>&day_of_week=<0-6> ───────
// Soft-delete: sets is_active = false (preserves audit trail).
export async function DELETE(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const schoolId = request.nextUrl.searchParams.get('school_id');
    const dowParam = request.nextUrl.searchParams.get('day_of_week');

    if (!schoolId) return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    if (!dowParam) return NextResponse.json({ error: 'day_of_week required' }, { status: 400 });
    const dow = parseInt(dowParam, 10);
    if (Number.isNaN(dow) || dow < 0 || dow > 6) {
      return NextResponse.json({ error: 'day_of_week must be 0–6' }, { status: 400 });
    }

    if (!isSchoolAdmin(session, schoolId)) {
      return NextResponse.json({ error: 'School admin access required' }, { status: 403 });
    }

    const supabase = getAdminClient();
    const { error } = await supabase
      .from('school_day_schedules')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('school_id', schoolId)
      .eq('day_of_week', dow);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      message: `${DAY_NAMES[dow]} schedule override removed`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to remove day schedule';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
