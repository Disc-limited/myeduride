// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { canAccessGateOperations } from '@/lib/gate/access';
import { todayInLagos } from '@/lib/timezone';
import { nowUtcIso } from '@/lib/utils/time';
import { logGateActivity } from '@/lib/gate/activity-log';

export const dynamic = 'force-dynamic';

/**
 * GET /api/gate/escort-batch
 * Resolves an escort's student roster for batch gate reception/release,
 * or lists active school escorts for direct gate selection.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('school_id');
    let query = searchParams.get('query')?.trim() || '';
    const listActive = searchParams.get('list_active') === '1';

    if (!schoolId) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }

    if (!canAccessGateOperations(session, schoolId)) {
      return NextResponse.json({ error: 'Gate access required' }, { status: 403 });
    }

    const supabase = getAdminClient();
    const today = todayInLagos();

    // 1. If listActive or query is empty, list all active escorts with assigned students at this school
    if (listActive || !query) {
      const { data: assignments, error: assignErr } = await supabase
        .from('escort_assignments')
        .select(`
          id,
          escort_application_id,
          student_id,
          status,
          escort:escort_applications(
            id,
            user_id,
            full_name,
            phone,
            passport_photograph,
            today_trip_status,
            ready_for_pickup
          )
        `)
        .eq('school_id', schoolId)
        .in('status', ['active', 'pending_confirmation']);

      if (assignErr) {
        return NextResponse.json({ error: assignErr.message }, { status: 500 });
      }

      // Aggregate by escort
      const escortsMap = new Map();
      for (const a of assignments || []) {
        const escortAppId = a.escort_application_id || a.escort?.id;
        if (!escortAppId) continue;

        if (!escortsMap.has(escortAppId)) {
          escortsMap.set(escortAppId, {
            escort_id: escortAppId,
            user_id: a.escort?.user_id || null,
            name: a.escort?.full_name || 'Assigned Escort',
            phone: a.escort?.phone || '',
            photo_url: a.escort?.passport_photograph || null,
            today_trip_status: a.escort?.today_trip_status || 'pending',
            ready_for_pickup: Boolean(a.escort?.ready_for_pickup),
            assigned_student_ids: [],
          });
        }
        if (a.student_id) {
          escortsMap.get(escortAppId).assigned_student_ids.push(a.student_id);
        }
      }

      const activeEscortsList = Array.from(escortsMap.values()).map((e) => ({
        ...e,
        student_count: e.assigned_student_ids.length,
      }));

      return NextResponse.json({
        success: true,
        active_escorts: activeEscortsList,
      });
    }

    // 2. Resolve specific Escort via query (card scan or manual search)
    let cleanQuery = query;
    if (cleanQuery.toUpperCase().startsWith('MYEDURIDE:ESCORT:')) {
      cleanQuery = cleanQuery.slice('MYEDURIDE:ESCORT:'.length).trim();
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanQuery);

    let escortRecord: any = null;

    if (isUuid) {
      // Check escort_applications by id or user_id
      const { data: byId } = await supabase
        .from('escort_applications')
        .select('*')
        .or(`id.eq.${cleanQuery},user_id.eq.${cleanQuery}`)
        .maybeSingle();

      if (byId) {
        escortRecord = byId;
      } else {
        // Check user_profiles
        const { data: userProf } = await supabase
          .from('user_profiles')
          .select('id, full_name, phone, avatar_url, username')
          .eq('id', cleanQuery)
          .maybeSingle();

        if (userProf) {
          const { data: appByUser } = await supabase
            .from('escort_applications')
            .select('*')
            .eq('user_id', userProf.id)
            .maybeSingle();

          escortRecord = appByUser || {
            id: userProf.id,
            user_id: userProf.id,
            full_name: userProf.full_name,
            phone: userProf.phone,
            passport_photograph: userProf.avatar_url,
          };
        }
      }
    } else {
      // Search by phone, email, full_name, or nin in escort_applications
      const { data: bySearch } = await supabase
        .from('escort_applications')
        .select('*')
        .or(`phone.ilike.%${cleanQuery}%,email.ilike.%${cleanQuery}%,full_name.ilike.%${cleanQuery}%,nin.eq.${cleanQuery}`)
        .limit(1)
        .maybeSingle();

      if (bySearch) {
        escortRecord = bySearch;
      } else {
        // Search in user_profiles
        const { data: userProf } = await supabase
          .from('user_profiles')
          .select('id, full_name, phone, avatar_url, username')
          .or(`phone.ilike.%${cleanQuery}%,username.ilike.%${cleanQuery}%,full_name.ilike.%${cleanQuery}%`)
          .limit(1)
          .maybeSingle();

        if (userProf) {
          const { data: appByUser } = await supabase
            .from('escort_applications')
            .select('*')
            .eq('user_id', userProf.id)
            .maybeSingle();

          escortRecord = appByUser || {
            id: userProf.id,
            user_id: userProf.id,
            full_name: userProf.full_name,
            phone: userProf.phone,
            passport_photograph: userProf.avatar_url,
          };
        }
      }
    }

    if (!escortRecord) {
      return NextResponse.json({ error: 'No matching escort found for this code or number' }, { status: 404 });
    }

    // 3. Find assigned vehicle and route for this escort
    const [vehicleRes, routeRes] = await Promise.all([
      supabase
        .from('school_vehicles')
        .select('id, reg_number, make, model, type, capacity, assigned_driver_name')
        .eq('school_id', schoolId)
        .eq('assigned_escort_id', escortRecord.id)
        .maybeSingle(),
      supabase
        .from('transport_routes')
        .select('id, name, code, departure_morning, departure_afternoon')
        .eq('school_id', schoolId)
        .eq('assigned_escort_id', escortRecord.id)
        .maybeSingle(),
    ]);

    const vehicle = vehicleRes.data;
    const route = routeRes.data;

    // 4. Retrieve all students assigned to this escort for this school
    let assignQuery = supabase
      .from('escort_assignments')
      .select(`
        student_id,
        status,
        student:students(
          id,
          first_name,
          last_name,
          student_id_number,
          photo_url,
          house_address,
          pickup_address,
          class_id,
          class:school_classes(name)
        )
      `)
      .eq('school_id', schoolId)
      .in('status', ['active', 'pending_confirmation']);

    if (escortRecord.id && escortRecord.user_id) {
      assignQuery = assignQuery.or(`escort_application_id.eq.${escortRecord.id},escort_application_id.eq.${escortRecord.user_id}`);
    } else {
      assignQuery = assignQuery.eq('escort_application_id', escortRecord.id || escortRecord.user_id);
    }

    const { data: assignments, error: assignErr } = await assignQuery;
    if (assignErr) {
      return NextResponse.json({ error: assignErr.message }, { status: 500 });
    }

    const rawStudents = (assignments || [])
      .map((a) => a.student)
      .filter(Boolean);

    const studentIds = rawStudents.map((s) => s.id);

    // 5. Fetch Today's Attendance Records for these students
    let arrivalsMap = new Map();
    let departuresMap = new Map();

    if (studentIds.length > 0) {
      const [arrRes, depRes] = await Promise.all([
        supabase
          .from('attendance_records')
          .select('student_id, timestamp, verification_method')
          .eq('school_id', schoolId)
          .in('student_id', studentIds)
          .eq('type', 'arrival')
          .gte('timestamp', `${today}T00:00:00.000Z`)
          .lte('timestamp', `${today}T23:59:59.999Z`),
        supabase
          .from('attendance_records')
          .select('student_id, timestamp, verification_method')
          .eq('school_id', schoolId)
          .in('student_id', studentIds)
          .eq('type', 'departure')
          .gte('timestamp', `${today}T00:00:00.000Z`)
          .lte('timestamp', `${today}T23:59:59.999Z`),
      ]);

      (arrRes.data || []).forEach((a) => arrivalsMap.set(a.student_id, a));
      (depRes.data || []).forEach((d) => departuresMap.set(d.student_id, d));
    }

    // 6. Build Manifest with Status
    const studentsManifest = rawStudents.map((st) => {
      const arr = arrivalsMap.get(st.id);
      const dep = departuresMap.get(st.id);
      const cls = Array.isArray(st.class) ? st.class[0]?.name : (st.class?.name || 'Class');

      return {
        id: st.id,
        name: `${st.first_name || ''} ${st.last_name || ''}`.trim() || 'Student',
        student_id_number: st.student_id_number || 'N/A',
        photo_url: st.photo_url || null,
        class_name: cls,
        pickup_address: st.house_address || st.pickup_address || 'Designated Stop',
        today_status: {
          has_arrival: Boolean(arr),
          arrival_time: arr?.timestamp ? new Date(arr.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
          has_departure: Boolean(dep),
          departure_time: dep?.timestamp ? new Date(dep.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
        },
      };
    });

    const alreadyArrived = studentsManifest.filter((s) => s.today_status.has_arrival).length;
    const alreadyDeparted = studentsManifest.filter((s) => s.today_status.has_departure).length;
    const totalCount = studentsManifest.length;

    // Suggest mode: if less than half checked in, suggest morning arrival; else afternoon departure
    const currentHour = new Date().getHours();
    const suggestedMode = currentHour < 12 ? 'arrival' : 'departure';

    return NextResponse.json({
      success: true,
      type: 'escort_batch',
      escort: {
        id: escortRecord.id,
        user_id: escortRecord.user_id,
        name: escortRecord.full_name || 'Assigned Escort',
        phone: escortRecord.phone || '',
        photo_url: escortRecord.passport_photograph || escortRecord.photo_url || null,
        vehicle_plate: vehicle?.reg_number || 'Transit Vehicle',
        vehicle_name: vehicle ? `${vehicle.make || ''} ${vehicle.model || ''}`.trim() : 'School Bus Fleet',
        route_name: route?.name || 'Assigned Route',
        route_code: route?.code || 'RT-01',
        today_trip_status: escortRecord.today_trip_status || 'pending',
        ready_for_pickup: Boolean(escortRecord.ready_for_pickup),
      },
      students: studentsManifest,
      batch_metrics: {
        total_assigned: totalCount,
        already_checked_in: alreadyArrived,
        already_checked_out: alreadyDeparted,
        pending_arrival: Math.max(0, totalCount - alreadyArrived),
        pending_departure: Math.max(0, totalCount - alreadyDeparted),
      },
      suggested_mode: suggestedMode,
    });
  } catch (err: any) {
    console.error('[gate/escort-batch GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/gate/escort-batch
 * Batch receives or releases all (or selected) students from an escort in one atomic execution.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { school_id, escort_id, escort_name, student_ids, mode, is_override, override_reason, vehicle_plate } = body;

    if (!school_id) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }
    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      return NextResponse.json({ error: 'At least one student must be selected' }, { status: 400 });
    }
    if (mode !== 'arrival' && mode !== 'departure') {
      return NextResponse.json({ error: 'mode must be arrival or departure' }, { status: 400 });
    }

    if (!canAccessGateOperations(session, school_id)) {
      return NextResponse.json({ error: 'Gate access required' }, { status: 403 });
    }

    const supabase = getAdminClient();
    const timestamp = nowUtcIso();
    const verificationMethod = is_override ? 'manual' : 'id_card_scan';

    // Prepare batch rows for attendance_records
    const attendanceRows = student_ids.map((sId: string) => ({
      school_id,
      student_id: sId,
      type: mode,
      verified_by_user_id: session.user_id,
      verification_method: verificationMethod,
      status: 'present',
      timestamp,
    }));

    // Insert batch attendance
    const { error: insertErr } = await supabase
      .from('attendance_records')
      .insert(attendanceRows);

    if (insertErr) {
      console.error('[gate/escort-batch POST] attendance insert error:', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Log gate activity
    const actionLabel = is_override
      ? `escort_batch_override_${mode}`
      : `escort_batch_${mode}`;

    await logGateActivity(supabase, {
      school_id,
      actor_user_id: session.user_id,
      actor_name: session.full_name || 'Gate Officer',
      action: actionLabel,
      entity_type: 'escort_batch',
      entity_id: escort_id || null,
      details: {
        escort_name: escort_name || 'Assigned Escort',
        vehicle_plate: vehicle_plate || 'Transit Bus',
        student_count: student_ids.length,
        mode,
        is_override: Boolean(is_override),
        override_reason: override_reason || (is_override ? 'Complete headcount verified by Gate Officer override' : null),
        timestamp,
      },
    });

    // Write audit log
    const { writeAuditLog } = await import('@/lib/audit/log');
    await writeAuditLog(supabase, {
      school_id,
      actor_user_id: session.user_id,
      action: actionLabel,
      entity_type: 'escorts',
      details: {
        escort_id,
        escort_name,
        mode,
        student_count: student_ids.length,
        student_ids,
        override_reason,
        timestamp,
      },
    });

    return NextResponse.json({
      success: true,
      processed_count: student_ids.length,
      mode,
      is_override: Boolean(is_override),
      message: `${student_ids.length} students successfully ${
        mode === 'arrival' ? 'signed in and received from escort' : 'signed out and released to escort'
      }! Gate queue cleared.`,
    });
  } catch (err: any) {
    console.error('[gate/escort-batch POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
