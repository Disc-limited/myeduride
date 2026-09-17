// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { canAccessGateOperations } from '@/lib/gate/access';
import { todayInLagos } from '@/lib/timezone';
import { nowUtcIso } from '@/lib/utils/time';
import { logGateActivity } from '@/lib/gate/activity-log';
import { notifyParentsOfAttendance } from '@/lib/notifications/parent-notify';
import { ensureAutoReadyForPickup } from '@/lib/gate/auto-ready-pickup';
import {
  ESCORT_MAX_BATCH_SIZE,
  getEscortBatchStatus,
} from '@/lib/escort/batch-capacity';

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
    await ensureAutoReadyForPickup(supabase, schoolId);

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
    cleanQuery = cleanQuery.replace(/[,()]/g, '').trim();

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
      // Search by card id / escort_code (printed barcode), phone, email, name, or NIN
      const { data: bySearch } = await supabase
        .from('escort_applications')
        .select('*')
        .or(`id.eq.${cleanQuery},escort_code.eq.${cleanQuery},phone.ilike.%${cleanQuery}%,email.ilike.%${cleanQuery}%,full_name.ilike.%${cleanQuery}%,nin.eq.${cleanQuery}`)
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

    const currentHour = new Date().getHours();
    const suggestedMode = currentHour < 12 ? 'arrival' : 'departure';

    // Query today's doorstep pickup / afternoon custody status
    const morningPickedUpStudentIds = new Set<string>();
    const afternoonOnBoardIds = new Set<string>();
    const afternoonDroppedIds = new Set<string>();
    const escortIdTokens = [escortRecord.id, escortRecord.user_id].filter(Boolean);
    if (studentIds.length > 0) {
      const { data: tripRecords } = await supabase
        .from('escort_student_daily_trips')
        .select('student_id, morning_picked_up, afternoon_picked_up, afternoon_dropped_off')
        .eq('trip_date', today)
        .in('escort_id', escortIdTokens);

      (tripRecords || []).forEach((t: any) => {
        if (t.morning_picked_up) morningPickedUpStudentIds.add(t.student_id);
        if (t.afternoon_picked_up && !t.afternoon_dropped_off) afternoonOnBoardIds.add(t.student_id);
        if (t.afternoon_dropped_off) afternoonDroppedIds.add(t.student_id);
      });
    }

    // Afternoon: prefer students marked Ready for Pickup at gate
    const readyStudentIds = new Set<string>();
    if (suggestedMode === 'departure' && studentIds.length > 0) {
      const { data: readyRows } = await supabase
        .from('dismissal_requests')
        .select('student_id')
        .eq('school_id', schoolId)
        .eq('dismissal_date', today)
        .in('status', ['pending', 'approved'])
        .in('student_id', studentIds);
      (readyRows || []).forEach((r: any) => readyStudentIds.add(r.student_id));
    }

    const batchStatus = await getEscortBatchStatus(
      supabase,
      escortIdTokens,
      suggestedMode === 'arrival' ? 'morning' : 'afternoon',
      today
    );

    // Morning: only students already boarded at home (awaiting school drop-off).
    // Afternoon: ready students first, still at school, not already with escort — max 9 seats.
    let activeStudentsSource = suggestedMode === 'arrival'
      ? rawStudents.filter((st: any) => morningPickedUpStudentIds.has(st.id) && !arrivalsMap.has(st.id))
      : rawStudents.filter((st: any) => {
          if (departuresMap.has(st.id) || afternoonOnBoardIds.has(st.id) || afternoonDroppedIds.has(st.id)) {
            return false;
          }
          if (!arrivalsMap.has(st.id) && !morningPickedUpStudentIds.has(st.id)) return false;
          if (readyStudentIds.size > 0) return readyStudentIds.has(st.id);
          return true;
        });

    if (suggestedMode === 'departure') {
      // Sort ready first, then cap to remaining batch seats
      activeStudentsSource = [...activeStudentsSource].sort((a: any, b: any) => {
        const ar = readyStudentIds.has(a.id) ? 0 : 1;
        const br = readyStudentIds.has(b.id) ? 0 : 1;
        return ar - br;
      });
      const seats = Math.max(0, Math.min(ESCORT_MAX_BATCH_SIZE, batchStatus.seats_remaining || ESCORT_MAX_BATCH_SIZE));
      activeStudentsSource = activeStudentsSource.slice(0, seats);
    }

    // 6. Build Manifest with Status
    const studentsManifest = activeStudentsSource.map((st) => {
      const arr = arrivalsMap.get(st.id);
      const dep = departuresMap.get(st.id);
      const cls = Array.isArray(st.class) ? st.class[0]?.name : (st.class?.name || 'Class');

      return {
        id: st.id,
        name: `${st.first_name || ''} ${st.last_name || ''}`.trim() || 'Student',
        student_id_number: st.student_id_number || 'N/A',
        photo_url: st.photo_url || null,
        class_name: cls,
        pickup_address: st.house_address || 'Designated Stop',
        was_picked_up_by_escort: morningPickedUpStudentIds.has(st.id),
        ready_for_pickup: readyStudentIds.has(st.id),
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
        max_batch: ESCORT_MAX_BATCH_SIZE,
        on_board: batchStatus.on_board,
        seats_remaining: batchStatus.seats_remaining,
        daily_legs_used: batchStatus.daily_legs_used,
        daily_legs_remaining: batchStatus.daily_legs_remaining,
        batch_message: batchStatus.message,
      },
      batch: batchStatus,
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
    const todayDate = todayInLagos();
    if (mode === 'departure') {
      await ensureAutoReadyForPickup(supabase, school_id);
    }

    const escortTokens = [escort_id].filter(Boolean);
    let releaseIds = [...student_ids];

    if (mode === 'departure' && escortTokens.length > 0) {
      const batchStatus = await getEscortBatchStatus(supabase, escortTokens, 'afternoon', todayDate);
      if (batchStatus.seats_remaining <= 0) {
        return NextResponse.json(
          {
            error: batchStatus.message || `Escort already has ${ESCORT_MAX_BATCH_SIZE} students. They must deliver home before a second batch.`,
            batch: batchStatus,
            code: 'batch_full',
          },
          { status: 409 }
        );
      }
      if (releaseIds.length > batchStatus.seats_remaining) {
        releaseIds = releaseIds.slice(0, batchStatus.seats_remaining);
      }
      if (releaseIds.length === 0) {
        return NextResponse.json(
          { error: 'No seats remaining in this escort batch (max 9).', batch: batchStatus, code: 'batch_full' },
          { status: 409 }
        );
      }
    }

    const { data: existingToday } = await supabase
      .from('attendance_records')
      .select('student_id')
      .eq('school_id', school_id)
      .eq('type', mode)
      .in('student_id', releaseIds)
      .gte('timestamp', `${todayDate}T00:00:00.000Z`)
      .lte('timestamp', `${todayDate}T23:59:59.999Z`);

    const alreadyRecorded = new Set((existingToday || []).map((r: any) => r.student_id));
    const newStudentIds = releaseIds.filter((sId: string) => !alreadyRecorded.has(sId));

    let insertedRecords: any[] = [];
    if (newStudentIds.length > 0) {
      const attendanceRows = newStudentIds.map((sId: string) => ({
        school_id,
        student_id: sId,
        type: mode,
        verified_by_user_id: session.user_id,
        verification_method: verificationMethod,
        status: 'present',
        timestamp,
      }));

      const { data: inserted, error: insertErr } = await supabase
        .from('attendance_records')
        .insert(attendanceRows)
        .select('id, student_id');

      if (insertErr) {
        console.error('[gate/escort-batch POST] attendance insert error:', insertErr);
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
      insertedRecords = inserted || [];
    }

    for (const rec of insertedRecords) {
      try {
        await notifyParentsOfAttendance({
          student_id: rec.student_id,
          attendance_record_id: rec.id,
          type: mode,
          via: 'escort',
          escort_name: escort_name || 'Assigned Escort',
        });
      } catch (notifyErr) {
        console.warn('[gate/escort-batch] parent notify notice:', notifyErr);
      }
    }

    // Clear Ready for Pickup queue for students just released with escort
    if (mode === 'departure' && newStudentIds.length > 0) {
      await supabase
        .from('dismissal_requests')
        .update({ status: 'completed', completed_at: timestamp })
        .eq('school_id', school_id)
        .eq('dismissal_date', todayDate)
        .in('student_id', newStudentIds)
        .in('status', ['pending', 'approved']);
    }

    // If afternoon departure, immediately convert students to PICKED UP for the escort
    if (mode === 'departure' && escort_id) {
      try {
        for (const sId of releaseIds) {
          const { data: existingTrip } = await supabase
            .from('escort_student_daily_trips')
            .select('id')
            .eq('trip_date', todayDate)
            .eq('escort_id', escort_id)
            .eq('student_id', sId)
            .maybeSingle();

          if (existingTrip) {
            await supabase
              .from('escort_student_daily_trips')
              .update({
                afternoon_picked_up: true,
                afternoon_picked_up_at: timestamp,
                updated_at: timestamp,
              })
              .eq('id', existingTrip.id);
          } else {
            await supabase
              .from('escort_student_daily_trips')
              .insert({
                trip_date: todayDate,
                escort_id,
                student_id: sId,
                school_id,
                afternoon_picked_up: true,
                afternoon_picked_up_at: timestamp,
                updated_at: timestamp,
              });
          }
        }
      } catch (tripErr) {
        console.warn('[gate/escort-batch] update daily trips notice:', tripErr);
      }
    }

    const finalBatch =
      escortTokens.length > 0
        ? await getEscortBatchStatus(
            supabase,
            escortTokens,
            mode === 'arrival' ? 'morning' : 'afternoon',
            todayDate
          )
        : null;

    // Log gate activity (one summary row for the batch)
    const batchAction = is_override
      ? 'manual_override'
      : mode === 'arrival'
        ? 'check_in'
        : 'check_out';

    await logGateActivity(supabase, {
      school_id,
      gate_officer_user_id: session.user_id,
      actor_name: session.full_name || 'Gate Officer',
      action_type: batchAction as any,
      student_id: releaseIds[0] || null,
      details: {
        escort_batch: true,
        escort_id: escort_id || null,
        escort_name: escort_name || 'Assigned Escort',
        vehicle_plate: vehicle_plate || 'Transit Bus',
        student_count: releaseIds.length,
        student_ids: releaseIds,
        mode,
        attendance_type: mode === 'arrival' ? 'arrival' : 'departure',
        is_override: Boolean(is_override),
        override_reason:
          override_reason ||
          (is_override ? 'Complete headcount verified by Gate Officer override' : null),
        timestamp,
        batch: finalBatch,
      },
    });

    // Write audit log
    const { writeAuditLog } = await import('@/lib/audit/log');
    await writeAuditLog(supabase, {
      school_id,
      actor_user_id: session.user_id,
      action: is_override ? `escort_batch_override_${mode}` : `escort_batch_${mode}`,
      entity_type: 'escorts',
      details: {
        escort_id,
        escort_name,
        mode,
        student_count: releaseIds.length,
        student_ids: releaseIds,
        override_reason,
        timestamp,
      },
    });

    return NextResponse.json({
      success: true,
      processed_count: releaseIds.length,
      mode,
      is_override: Boolean(is_override),
      batch: finalBatch,
      truncated_to_batch:
        mode === 'departure' && student_ids.length > releaseIds.length
          ? student_ids.length - releaseIds.length
          : 0,
      message: `${releaseIds.length} students successfully ${
        mode === 'arrival'
          ? 'signed in and received from escort (morning drop-off complete)'
          : `signed out to escort (batch ${finalBatch?.on_board || releaseIds.length}/${ESCORT_MAX_BATCH_SIZE})`
      }.`,
    });
  } catch (err: any) {
    console.error('[gate/escort-batch POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
